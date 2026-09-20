import type { LexicalNode } from 'lexical';
import type { LoroMap } from 'loro-crdt';

import type { AnnotationMap } from '@/plugins/properties/service/annotation';
import type {
  PropertiesAnnotationStorage,
  PropertiesCollaborationProvider,
  PropertiesCollaborationReadiness,
} from '@/plugins/properties/service/properties';
import type { AnnotationRecord } from '@/plugins/properties/types';
import { $getNodeId } from '@/plugins/properties/utils';

export interface LoroPropertiesBindingPort {
  getAnnotationMap(): LoroMap;
  getNodeIdentity(node: LexicalNode): string | undefined;
  getReadiness(): PropertiesCollaborationReadiness;
  runLocalTransaction(origin: string, mutate: () => void): void;
  subscribeReadiness(listener: () => void): () => void;
}

/** Adapts a LoroMap to the transport-neutral AnnotationMap port. */
export class LoroAnnotationMap implements AnnotationMap {
  private readonly observers = new Map<() => void, () => void>();
  private disposed = false;

  constructor(
    private readonly map: LoroMap,
    private readonly runLocalTransaction: (origin: string, mutate: () => void) => void,
  ) {}

  get size(): number {
    return this.map.keys().length;
  }

  clear(): void {
    this.assertOpen();
    const keys = this.map.keys();
    this.runLocalTransaction('loro:annotation/local', () => {
      for (const key of keys) this.map.delete(key);
    });
  }

  forEach(callback: (value: AnnotationRecord, key: string) => void): void {
    for (const key of this.map.keys()) {
      const value = this.map.get(key);
      if (value && typeof value === 'object' && !Array.isArray(value)) {
        callback(value as AnnotationRecord, key);
      }
    }
  }

  get(key: string): AnnotationRecord | undefined {
    const value = this.map.get(key);
    return value && typeof value === 'object' && !Array.isArray(value)
      ? (value as AnnotationRecord)
      : undefined;
  }

  set(key: string, value: AnnotationRecord): unknown {
    this.assertOpen();
    this.runLocalTransaction('loro:annotation/local', () => {
      this.map.set(key, value as never);
    });
    return value;
  }

  delete(key: string): boolean {
    this.assertOpen();
    const existed = this.map.get(key) !== undefined;
    this.runLocalTransaction('loro:annotation/local', () => {
      if (existed) this.map.delete(key);
    });
    return existed;
  }

  observe(callback: () => void): void {
    this.assertOpen();
    this.unobserve(callback);
    this.observers.set(
      callback,
      this.map.subscribe(() => callback()),
    );
  }

  unobserve(callback: () => void): void {
    this.observers.get(callback)?.();
    this.observers.delete(callback);
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    for (const unsubscribe of this.observers.values()) unsubscribe();
    this.observers.clear();
  }

  private assertOpen(): void {
    if (this.disposed) throw new Error('Loro annotation map is disposed.');
  }
}

export class LoroPropertiesProvider implements PropertiesCollaborationProvider {
  private readonly owner = {};
  private annotationDisposer: (() => void) | null = null;
  private annotationMap: LoroAnnotationMap | null = null;

  constructor(private readonly binding: LoroPropertiesBindingPort) {}

  attachAnnotationStorage(storage: PropertiesAnnotationStorage): () => void {
    this.annotationDisposer?.();
    const map = new LoroAnnotationMap(this.binding.getAnnotationMap(), (origin, mutate) =>
      this.binding.runLocalTransaction(origin, mutate),
    );
    this.annotationMap?.dispose();
    this.annotationMap = map;
    storage.attachMap(map, this.owner);
    let disposed = false;
    const dispose = () => {
      if (disposed) return;
      disposed = true;
      storage.detachMap(map, this.owner);
      map.dispose();
      if (this.annotationMap === map) this.annotationMap = null;
      if (this.annotationDisposer === dispose) this.annotationDisposer = null;
    };
    this.annotationDisposer = dispose;
    return dispose;
  }

  getNodeIdentity(node: LexicalNode): string | undefined {
    return this.binding.getNodeIdentity(node) ?? $getNodeId(node);
  }

  getReadiness(): PropertiesCollaborationReadiness {
    return this.binding.getReadiness();
  }

  subscribe(listener: () => void): () => void {
    return this.binding.subscribeReadiness(listener);
  }

  dispose(): void {
    this.annotationDisposer?.();
    this.annotationMap?.dispose();
    this.annotationMap = null;
    this.annotationDisposer = null;
  }
}
