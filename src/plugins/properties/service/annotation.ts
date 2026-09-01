import { genServiceId } from '@/editor-kernel';
import type { IServiceID } from '@/types';

import type { AnnotationRecord, AnnotationStatus, JSONValue } from '../types';

export interface AnnotationServiceListener {
  (records: ReadonlyArray<AnnotationRecord>): void;
}

/**
 * Where the annotation record body is persisted.
 *
 * `embedded` is the backwards-compatible default: records are kept in the
 * document-level Y.Map and are included by the JSON metadata bridge.
 * `external` keeps records in the service cache and lets the host persist
 * them elsewhere (for example, a database) through mutation events.
 */
export type AnnotationStorageMode = 'embedded' | 'external';

export type AnnotationMutationSource = 'local' | 'import' | 'migration';

/**
 * A service mutation is deliberately transport-neutral. Hosts can translate
 * these events into optimistic database writes without knowing whether the
 * editor is backed by Yjs, a headless editor, or a React editor.
 */
export interface AnnotationMutation {
  id?: string;
  previous?: AnnotationRecord;
  previousRecords?: ReadonlyArray<AnnotationRecord>;
  record?: AnnotationRecord;
  records?: ReadonlyArray<AnnotationRecord>;
  source: AnnotationMutationSource;
  type: 'create' | 'update' | 'remove' | 'import' | 'migration';
}

export interface AnnotationMutationListener {
  (mutation: AnnotationMutation): void;
}

export interface AnnotationServiceOptions {
  storageMode?: AnnotationStorageMode;
}

export interface AnnotationImportOptions {
  /** Replace the current cache. Defaults to true. */
  replace?: boolean;
  source?: Exclude<AnnotationMutationSource, 'local'>;
}

export interface AnnotationService {
  attachYMap(map: AnnotationMap): void;
  create(record: Partial<AnnotationRecord> & { id: string }): AnnotationRecord;
  get(id: string): AnnotationRecord | null;
  getStorageMode(): AnnotationStorageMode;
  getAll(): AnnotationRecord[];
  importSnapshot(records: ReadonlyArray<AnnotationRecord>, options?: AnnotationImportOptions): void;
  remove(id: string): boolean;
  resolve(id: string, status?: 'active' | 'resolved'): AnnotationRecord | null;
  subscribe(listener: AnnotationServiceListener): () => void;
  subscribeMutations(listener: AnnotationMutationListener): () => void;
  setStorageMode(mode: AnnotationStorageMode): void;
  update(id: string, patch: Partial<AnnotationRecord>): AnnotationRecord | null;
}

export interface AnnotationMap {
  clear(): void;
  forEach(callback: (value: AnnotationRecord, key: string) => void): void;
  get(key: string): AnnotationRecord | undefined;
  observe?(callback: () => void): void;
  set(key: string, value: AnnotationRecord): unknown;
  unobserve?(callback: () => void): void;
  delete?(key: string): boolean | void;
  readonly size: number;
}

export const IAnnotationService: IServiceID<AnnotationService> =
  genServiceId<AnnotationService>('AnnotationService');

const clone = <T>(value: T): T => {
  if (typeof structuredClone === 'function') {
    try {
      return structuredClone(value);
    } catch {
      // Fall back to JSON cloning below.
      void 0;
    }
  }
  // eslint-disable-next-line unicorn/prefer-structured-clone
  return JSON.parse(JSON.stringify(value)) as T;
};

const now = () => new Date().toISOString();

const normalizeRecord = (
  input: Partial<AnnotationRecord> & { id: string },
  previous?: AnnotationRecord,
): AnnotationRecord => {
  const timestamp = now();
  return {
    author: input.author ?? previous?.author,
    createdAt: input.createdAt ?? previous?.createdAt ?? timestamp,
    id: input.id,
    kind: input.kind ?? previous?.kind ?? 'comment',
    nodeKeys: input.nodeKeys ?? previous?.nodeKeys,
    payload: clone((input.payload ?? previous?.payload ?? null) as JSONValue),
    quotedText: input.quotedText ?? previous?.quotedText ?? '',
    status: input.status ?? previous?.status ?? 'active',
    updatedAt: input.updatedAt ?? timestamp,
  };
};

export class AnnotationServiceImpl implements AnnotationService {
  private readonly cache = new MapAnnotationMap();
  private map: AnnotationMap = this.cache;
  private listeners = new Set<AnnotationServiceListener>();
  private mutationListeners = new Set<AnnotationMutationListener>();
  private attachedYMap: AnnotationMap | null = null;
  private migrationIds = new WeakMap<object, Set<string>>();
  private storageMode: AnnotationStorageMode = 'embedded';
  private yMapObserver: (() => void) | null = null;

  constructor(options: AnnotationServiceOptions = {}) {
    this.storageMode = options.storageMode ?? 'embedded';
  }

  getStorageMode(): AnnotationStorageMode {
    return this.storageMode;
  }

  setStorageMode(mode: AnnotationStorageMode): void {
    if (mode === this.storageMode) return;

    if (mode === 'external') {
      // Keep a local copy before detaching the Y.Map. No writes are performed
      // in this direction, so switching an existing editor to external mode
      // cannot modify collaborative state.
      const records = this.getAll();
      this.detachYMapObserver();
      this.cache.clear();
      for (const record of records) this.cache.set(record.id, record);
      this.map = this.cache;
      this.storageMode = mode;
      this.emit();
      return;
    }

    this.storageMode = mode;
    if (this.attachedYMap) {
      const records = this.cacheRecords();
      this.map = this.attachedYMap;
      for (const record of records) {
        if (!this.map.get(record.id)) this.map.set(record.id, record);
      }
      this.observeYMap(this.attachedYMap);
    } else {
      this.map = this.cache;
    }
    this.emit();
  }

  attachYMap(map: AnnotationMap): void {
    // Match the legacy service's one-time bootstrap: JSON/imported records are
    // copied into the first Y.Map, but a later provider reload must not seed a
    // fresh shared document with stale records from the previous map.
    const localRecords = this.attachedYMap ? [] : this.getAll();
    this.detachYMapObserver();
    this.attachedYMap = map;

    if (this.storageMode === 'external') {
      // Legacy Yjs records are read only once as a migration source. New
      // creates, updates, removes, and imports continue to target `cache`.
      this.map = this.cache;
      this.migrateLegacyRecords(map);
      return;
    }

    this.map = map;
    if (map.size === 0) {
      for (const record of localRecords) map.set(record.id, record);
    }
    this.observeYMap(map);
    this.emit();
  }

  create(input: Partial<AnnotationRecord> & { id: string }): AnnotationRecord {
    const record = normalizeRecord(input);
    this.map.set(record.id, record);
    this.emit();
    this.emitMutation({
      id: record.id,
      record,
      source: 'local',
      type: 'create',
    });
    return clone(record);
  }

  get(id: string): AnnotationRecord | null {
    const record = this.map.get(id);
    return record ? clone(record) : null;
  }

  getAll(): AnnotationRecord[] {
    const records: AnnotationRecord[] = [];
    this.map.forEach((record) => records.push(clone(record)));
    return records.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  }

  importSnapshot(
    records: ReadonlyArray<AnnotationRecord>,
    options: AnnotationImportOptions = {},
  ): void {
    // In embedded/collaborative mode Yjs remains authoritative. This keeps
    // the old JSON hydration behavior and prevents a late JSON read from
    // replacing records already present in the shared document.
    if (this.storageMode === 'embedded' && this.attachedYMap && this.map.size > 0) return;

    const previousRecords = this.getAll();
    const normalizedRecords = records
      .filter((record): record is AnnotationRecord =>
        Boolean(record && typeof record.id === 'string'),
      )
      .map((record) => normalizeRecord(record));

    if (options.replace !== false) this.map.clear();
    for (const record of normalizedRecords) {
      this.map.set(record.id, record);
    }

    this.emit();
    this.emitMutation({
      previousRecords,
      records: this.getAll(),
      source: options.source ?? 'import',
      type: 'import',
    });
  }

  remove(id: string): boolean {
    const previous = this.map.get(id);
    const existed = previous !== undefined;
    if (!existed) return false;
    this.map.delete?.(id);
    this.emit();
    this.emitMutation({
      id,
      previous,
      source: 'local',
      type: 'remove',
    });
    return true;
  }

  resolve(id: string, status: 'active' | 'resolved' = 'resolved'): AnnotationRecord | null {
    return this.update(id, { status });
  }

  subscribe(listener: AnnotationServiceListener): () => void {
    this.listeners.add(listener);
    listener(this.getAll());
    return () => this.listeners.delete(listener);
  }

  subscribeMutations(listener: AnnotationMutationListener): () => void {
    this.mutationListeners.add(listener);
    return () => this.mutationListeners.delete(listener);
  }

  update(id: string, patch: Partial<AnnotationRecord>): AnnotationRecord | null {
    const previous = this.map.get(id);
    if (!previous) return null;
    const record = normalizeRecord({ ...previous, ...patch, id }, previous);
    this.map.set(id, record);
    this.emit();
    this.emitMutation({
      id,
      previous,
      record,
      source: 'local',
      type: 'update',
    });
    return clone(record);
  }

  private emit(): void {
    const records = this.getAll();
    for (const listener of this.listeners) listener(records);
  }

  private emitMutation(mutation: AnnotationMutation): void {
    const event: AnnotationMutation = {
      ...mutation,
      previous: mutation.previous ? clone(mutation.previous) : undefined,
      previousRecords: mutation.previousRecords?.map((record) => clone(record)),
      record: mutation.record ? clone(mutation.record) : undefined,
      records: mutation.records?.map((record) => clone(record)),
    };
    for (const listener of this.mutationListeners) listener(event);
  }

  private cacheRecords(): AnnotationRecord[] {
    const records: AnnotationRecord[] = [];
    this.cache.forEach((record) => records.push(clone(record)));
    return records;
  }

  private detachYMapObserver(): void {
    if (this.yMapObserver && this.attachedYMap?.unobserve) {
      this.attachedYMap.unobserve(this.yMapObserver);
    }
    this.yMapObserver = null;
  }

  private observeYMap(map: AnnotationMap): void {
    this.yMapObserver = () => this.emit();
    map.observe?.(this.yMapObserver);
  }

  private migrateLegacyRecords(map: AnnotationMap): void {
    let seenIds = this.migrationIds.get(map as object);
    if (!seenIds) {
      seenIds = new Set<string>();
      this.migrationIds.set(map as object, seenIds);
    }

    const existingIds = new Set(this.cacheRecords().map((record) => record.id));
    const migrated: AnnotationRecord[] = [];
    map.forEach((value) => {
      if (!value || typeof value.id !== 'string' || seenIds!.has(value.id)) return;
      seenIds!.add(value.id);
      if (existingIds.has(value.id)) return;
      const record = normalizeRecord(value);
      this.cache.set(record.id, record);
      migrated.push(record);
    });

    if (migrated.length === 0) return;
    this.emit();
    this.emitMutation({
      records: migrated,
      source: 'migration',
      type: 'migration',
    });
  }
}

class MapAnnotationMap implements AnnotationMap {
  private map = new Map<string, AnnotationRecord>();

  get size() {
    return this.map.size;
  }

  clear() {
    this.map.clear();
  }

  forEach(callback: (value: AnnotationRecord, key: string) => void) {
    this.map.forEach(callback);
  }

  get(key: string) {
    return this.map.get(key);
  }

  set(key: string, value: AnnotationRecord) {
    this.map.set(key, value);
    return this;
  }

  delete(key: string) {
    return this.map.delete(key);
  }
}

export const createAnnotationRecord = (
  id: string,
  payload: JSONValue,
  options: Partial<AnnotationRecord> = {},
): AnnotationRecord => normalizeRecord({ ...options, id, payload });

export function isAnnotationStatus(value: unknown): value is AnnotationStatus {
  return value === 'active' || value === 'resolved' || value === 'orphaned';
}
