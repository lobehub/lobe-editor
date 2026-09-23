import { HeadingNode } from '@lexical/rich-text';
import { TableCellHeaderStates, TableCellNode, TableNode, TableRowNode } from '@lexical/table';
import type { EditorState, ElementNode, LexicalEditor, LexicalNode, TextNode } from 'lexical';
import {
  $createRangeSelection,
  $getRoot,
  $getSelection,
  $isDecoratorNode,
  $isElementNode,
  $isLineBreakNode,
  $isRangeSelection,
  $isTextNode,
  $setSelection,
  HISTORY_MERGE_TAG,
  HISTORY_PUSH_TAG,
} from 'lexical';
import {
  Cursor,
  LoroDoc,
  type LoroEventBatch,
  type LoroMap,
  type LoroTreeNode,
  type TreeID,
  UndoManager,
  type Value,
} from 'loro-crdt';

import { getKernelFromEditor } from '@/editor-kernel/utils';
import { ArtifactNode } from '@/plugins/artifact/node/ArtifactNode';
import { CodeMirrorNode } from '@/plugins/codemirror-block/node/CodeMirrorNode';
import { $isCursorNode } from '@/plugins/common/node/cursor';
import { $isHoleNode } from '@/plugins/common/node/hole';
import { $getLogicalChildren } from '@/plugins/common/node/logical-children';
import { IHoleService } from '@/plugins/common/service/i-hole-service';
import {
  $ensureNodeIdsInTree,
  $getNodeId,
  $getNodeProperties,
  $isNodeIdentityTarget,
  $setNodeProperties,
  createNodeId,
} from '@/plugins/properties';
import type { IPropertiesService } from '@/plugins/properties/service/properties';
import { IPropertiesService as IPropertiesServiceId } from '@/plugins/properties/service/properties';

import {
  createDefaultLoroCapabilities,
  isCapabilityParentAllowed,
  requiresSyntheticCapabilityIdentity,
} from './capabilities';
import {
  getAttachedMap,
  getAttachedText,
  LORO_LEXICAL_META_NAME,
  LORO_LEXICAL_SCHEMA,
  LoroCanonicalDocument,
  validateLoroBindingDescriptor,
} from './model';
import { LoroPropertiesProvider } from './properties-provider';
import {
  getFlowOwner,
  projectLoroFlow,
  readLexicalFlow,
  readLoroFlow,
  stripInlineFlowAttributes,
  updateLoroFlow,
  validateLoroFlowSnapshot,
} from './text-flow';
import type {
  LoroBindingDescriptor,
  LoroBindingReadiness,
  LoroNodeCapability,
  LoroNodeData,
  LoroSelectionPoint,
  LoroSelectionSnapshot,
} from './types';
import { createLoroBindingDescriptor } from './types';

export const LORO_REMOTE_TAG = 'loro:remote';
export const LORO_LOCAL_TAG = 'loro:local';
export const LORO_SYSTEM_ORIGIN_PREFIX = 'loro:system/';

interface ProjectionCacheEntry {
  attrs: Record<string, unknown>;
  body?: string;
  flow?: ReturnType<typeof readLexicalFlow>;
  parentTreeId?: TreeID;
  properties: Record<string, unknown>;
  treeId: TreeID;
}

interface HistorySelectionValue {
  after: LoroSelectionSnapshot | null;
  before: LoroSelectionSnapshot | null;
  version: 1;
}

interface PendingHistoryPush {
  cursors: Cursor[];
  value: HistorySelectionValue;
}

export interface LoroLexicalBindingOptions {
  capabilities?: ReadonlyArray<LoroNodeCapability>;
  descriptor?: LoroBindingDescriptor;
  doc?: LoroCanonicalDocument | LoroDoc;
  editor: LexicalEditor;
  /** Whether an empty canonical document is already an authoritative snapshot. */
  hasAcceptedInitialSnapshot?: boolean;
  shouldBootstrap?: boolean;
}

const clone = <T>(value: T): T => {
  if (typeof structuredClone === 'function') {
    try {
      return structuredClone(value);
    } catch {
      // JSON-safe binding metadata falls through to the portable clone.
    }
  }
  // Keep a JSON-safe fallback for headless/browser runtimes without structuredClone.
  // eslint-disable-next-line unicorn/prefer-structured-clone
  return JSON.parse(JSON.stringify(value)) as T;
};

const isStructuralNode = (node: LexicalNode): boolean =>
  !$isTextNode(node) && !$isLineBreakNode(node) && !$isHoleNode(node);

const directLogicalChildren = (node: LexicalNode): LexicalNode[] => {
  if (!$isElementNode(node)) return [];
  return $getLogicalChildren(node);
};

const readNodeAttrs = (node: LexicalNode): Record<string, unknown> => {
  const serialized = node.exportJSON() as Record<string, unknown>;
  const attrs: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(serialized)) {
    if (['$', 'children', 'id', 'text', 'type', 'version'].includes(key)) continue;
    if (key === 'code' && node.getType() === 'code') continue;
    if (key === 'html' && node.getType() === 'artifact') continue;
    attrs[key] = clone(value);
  }
  return attrs;
};

const readEmbeddedBody = (node: LexicalNode): string | undefined => {
  const candidate = node as LexicalNode & {
    code?: string;
    getHtml?: () => string;
  };
  if (node.getType() === 'artifact' && typeof candidate.getHtml === 'function') {
    return candidate.getHtml();
  }
  if (node.getType() === 'code' && typeof candidate.code === 'string') return candidate.code;
  if (node.getType() === CodeMirrorNode.getType()) return node.getTextContent();
  return undefined;
};

const nodeRole = (node: LexicalNode): LoroNodeData['role'] => {
  if ($isElementNode(node)) return node.isInline() ? 'inline' : 'element';
  return node.isInline() ? 'atom' : 'block-decorator';
};

const getCapabilityMap = (capabilities: ReadonlyArray<LoroNodeCapability>) =>
  new Map(capabilities.map((capability) => [capability.type, capability]));

const sameRecordValue = (left: unknown, right: unknown): boolean => {
  if (Object.is(left, right)) return true;
  return JSON.stringify(left) === JSON.stringify(right);
};

export class LoroLexicalBinding {
  readonly canonical: LoroCanonicalDocument;
  readonly descriptor: LoroBindingDescriptor;
  readonly editor: LexicalEditor;
  readonly undoManager: UndoManager;

  private readonly capabilities: Map<string, LoroNodeCapability>;
  private readonly lexicalByNodeId = new Map<string, LexicalNode>();
  private readonly projectionCache = new Map<string, ProjectionCacheEntry>();
  private readonly readinessListeners = new Set<() => void>();
  private readonly propertiesService: IPropertiesService | null;
  private readonly propertiesProvider: LoroPropertiesProvider;
  private readonly unregisterProperties: (() => void) | null;
  private readonly unsubscribeLexical: () => void;
  private readonly unsubscribeLoro: () => void;
  private applyingLoro = 0;
  private disposed = false;
  private phase: LoroBindingReadiness['phase'] = 'initializing';
  private hasAcceptedInitialSnapshot = false;
  private allowInitializationSync = false;
  private controlledImportDepth = 0;
  private pendingTreeProjection = false;
  private readonly pendingNodeProjection = new Set<TreeID>();
  private readonly pendingFlowProjection = new Set<TreeID>();
  private pendingImportSelection: LoroSelectionSnapshot | null | undefined;
  private pendingHistorySelection: LoroSelectionSnapshot | null | undefined;
  private pendingHistoryProjection = false;
  private pendingLocalHistoryBefore: LoroSelectionSnapshot | null | undefined;
  private pendingLocalHistoryAfter: LoroSelectionSnapshot | null | undefined;
  private pendingHistoryPush: PendingHistoryPush | null = null;
  private pendingSyntheticHistoryPush: PendingHistoryPush | null = null;
  private readonly historySelectionOverrides = new Map<string, HistorySelectionValue>();
  private lastHistoryPushKey: string | null = null;
  private historyMergeInterval = 300;
  private pendingHistoryInterval: number | null = null;
  private forceNextHistoryInterval: number | null = null;
  private historyPushPending = false;
  private historyForcedCommitPending = false;
  private undoProjection = false;

  constructor(options: LoroLexicalBindingOptions) {
    this.editor = options.editor;
    this.descriptor = validateLoroBindingDescriptor(
      options.descriptor ?? createLoroBindingDescriptor(),
    );
    this.canonical =
      options.doc instanceof LoroCanonicalDocument
        ? options.doc
        : new LoroCanonicalDocument(options.doc ?? new LoroDoc(), this.descriptor, {
            initialize: options.shouldBootstrap !== false,
          });
    this.hasAcceptedInitialSnapshot =
      options.hasAcceptedInitialSnapshot ??
      (options.shouldBootstrap !== false || this.canonical.getNodes().length > 0);
    this.allowInitializationSync =
      this.hasAcceptedInitialSnapshot === false && options.shouldBootstrap !== false;
    this.capabilities = getCapabilityMap([
      ...createDefaultLoroCapabilities(),
      ...(options.capabilities ?? []),
    ]);
    this.undoManager = new UndoManager(this.canonical.doc, {
      excludeOriginPrefixes: [LORO_SYSTEM_ORIGIN_PREFIX, 'loro:annotation/', 'loro:remote/'],
      onPop: (isUndo, value, counterRange) => this.onHistoryPop(isUndo, value, counterRange),
      onPush: (isUndo, counterRange) => this.onHistoryPush(isUndo, counterRange),
    });

    this.propertiesProvider = new LoroPropertiesProvider(this);
    this.propertiesService =
      getKernelFromEditor(this.editor)?.requireService(IPropertiesServiceId) ?? null;
    this.unregisterProperties =
      this.propertiesService?.registerCollaborationProvider(this.propertiesProvider) ?? null;

    this.unsubscribeLoro = this.canonical.subscribe((event) => this.onLoroEvent(event));
    this.unsubscribeLexical = this.editor.registerUpdateListener((payload) => {
      if (payload.dirtyElements.size === 0 && payload.dirtyLeaves.size === 0) return;
      this.onLexicalUpdate(payload.editorState, payload.tags, payload.prevEditorState);
    });

    if (options.shouldBootstrap !== false && this.canonical.getNodes().length === 0) {
      this.editor.update(
        () => {
          $ensureNodeIdsInTree();
          this.ensureSyntheticCapabilityIds();
          this.ensureInlineCapabilityIds();
        },
        {
          onUpdate: () => {
            if (this.disposed || this.canonical.getNodes().length > 0) return;
            this.editor.update(
              () => {
                $ensureNodeIdsInTree();
                this.ensureSyntheticCapabilityIds();
                this.ensureInlineCapabilityIds();
              },
              {
                onUpdate: () => {
                  if (!this.disposed && this.canonical.getNodes().length === 0) {
                    this.syncLexicalToLoro(this.editor.getEditorState());
                  }
                },
                tag: LORO_LOCAL_TAG,
              },
            );
          },
          tag: LORO_LOCAL_TAG,
        },
      );
    } else {
      this.projectCanonicalToLexical();
    }
  }

  getReadiness(): 'initializing' | 'ready' {
    return this.phase === 'ready' ? 'ready' : 'initializing';
  }

  getPhase(): LoroBindingReadiness['phase'] {
    return this.phase;
  }

  canUndo(): boolean {
    return this.isHistoryWritable() && this.undoManager.canUndo();
  }

  canRedo(): boolean {
    return this.isHistoryWritable() && this.undoManager.canRedo();
  }

  setHistoryMergeInterval(interval: number): void {
    if (!Number.isFinite(interval) || interval < 0) {
      throw new RangeError('Loro history merge interval must be a non-negative number.');
    }
    this.historyMergeInterval = interval;
    this.undoManager.setMergeInterval(interval);
  }

  captureHistoryAfterCommit(editorState?: EditorState): void {
    if (!this.lastHistoryPushKey) return;
    const entry = this.historySelectionOverrides.get(this.lastHistoryPushKey);
    editorState?.read(() => this.indexLexicalTree($getRoot()));
    const current = editorState
      ? this.captureSelectionFromEditorState(editorState)
      : this.captureSelection();
    if (entry && current) entry.after = current;
  }

  prepareHistoryUpdate(tags: ReadonlySet<string>): void {
    if (this.pendingHistoryInterval !== null) {
      this.undoManager.setMergeInterval(this.pendingHistoryInterval);
      return;
    }
    if (this.forceNextHistoryInterval !== null) {
      this.pendingHistoryInterval = this.forceNextHistoryInterval;
      this.historyForcedCommitPending = true;
      this.undoManager.setMergeInterval(this.pendingHistoryInterval);
      return;
    }
    if (tags.has(HISTORY_PUSH_TAG)) {
      this.finishHistoryGroup();
      this.undoManager.setMergeInterval(0);
      this.pendingHistoryInterval = 0;
      this.historyPushPending = true;
      this.historyForcedCommitPending = false;
      return;
    }
    if (tags.has(HISTORY_MERGE_TAG)) {
      // Lexical's merge tag can intentionally bridge the normal delay. Loro
      // has no stopCapturing API, so temporarily widen only this commit.
      this.undoManager.setMergeInterval(Number.MAX_SAFE_INTEGER);
      this.pendingHistoryInterval = Number.MAX_SAFE_INTEGER;
      this.historyPushPending = false;
      this.historyForcedCommitPending = false;
      return;
    }
    this.finishHistoryGroup();
    this.undoManager.setMergeInterval(this.historyMergeInterval);
  }

  completeHistoryUpdate(tags: ReadonlySet<string>): void {
    if (tags.has(HISTORY_PUSH_TAG) || tags.has(HISTORY_MERGE_TAG)) {
      if (this.pendingHistoryInterval !== null) return;
      this.finishHistoryGroup();
      this.undoManager.setMergeInterval(this.historyMergeInterval);
    }
  }

  subscribeReadiness(listener: () => void): () => void {
    this.readinessListeners.add(listener);
    listener();
    return () => this.readinessListeners.delete(listener);
  }

  getAnnotationMap(): LoroMap {
    return this.canonical.doc.getMap('lobe:annotations');
  }

  commitLocal(origin: string): void {
    this.runLocalTransaction(origin, () => undefined);
  }

  runLocalTransaction(origin: string, mutate: () => void): void {
    if (this.disposed) {
      throw new Error('Loro binding is disposed.');
    }
    if (this.phase === 'incompatible') {
      throw new Error('Loro binding is incompatible; recreate it before writing local CRDT data.');
    }
    if (!this.hasAcceptedInitialSnapshot) {
      throw new Error('Loro binding is awaiting its authoritative initial snapshot.');
    }
    this.canonical.commit(mutate, { origin });
  }

  getPropertiesProvider(): LoroPropertiesProvider {
    return this.propertiesProvider;
  }

  getNodeIdentity(node: LexicalNode): string | undefined {
    const direct = $getNodeId(node);
    if (direct) return direct;
    for (const [nodeId, entry] of this.projectionCache) {
      if (entry.treeId === node.getKey()) return nodeId;
    }
    return undefined;
  }

  applyUpdate(update: Uint8Array, options: { trusted?: boolean } = {}): void {
    if (this.disposed) throw new Error('Loro binding is disposed.');
    if (this.phase === 'incompatible') {
      throw new Error('Loro binding is incompatible; recreate it before importing more data.');
    }
    if (!this.hasAcceptedInitialSnapshot || options.trusted === false) {
      this.preflightIncomingUpdate(update);
    }
    // Force any Lexical update already queued by the caller through the local
    // listener before importing remote bytes. This is the causal boundary for
    // transport adapters; they must call this method instead of doc.import.
    this.editor.update(() => undefined, { discrete: true, tag: LORO_LOCAL_TAG });
    // Capture against the pre-import Loro text. Capturing in the import
    // subscriber would interpret the old Lexical offset against the new text
    // and lose the cursor's causal affinity.
    this.pendingImportSelection = this.captureSelection();
    this.controlledImportDepth += 1;
    try {
      // Loro 1.16.1 invokes doc subscribers synchronously from import(). The
      // subscriber performs the discrete Lexical projection before this call
      // returns, so callers never observe a half-imported editor state.
      const wasAccepted = this.hasAcceptedInitialSnapshot;
      this.hasAcceptedInitialSnapshot = true;
      try {
        this.canonical.import(update);
      } catch (error) {
        this.hasAcceptedInitialSnapshot = wasAccepted;
        throw error;
      }
    } finally {
      this.controlledImportDepth -= 1;
      this.pendingImportSelection = undefined;
    }
  }

  private preflightIncomingUpdate(update: Uint8Array): void {
    const candidate = LoroDoc.fromSnapshot(this.canonical.exportSnapshot());
    try {
      candidate.import(update);
      const metadata = candidate.getMap(LORO_LEXICAL_META_NAME);
      if (
        metadata.get('schemaVersion') !== LORO_LEXICAL_SCHEMA ||
        metadata.get('bindingSchema') !== this.descriptor.bindingSchema ||
        metadata.get('epoch') !== this.descriptor.epoch
      ) {
        throw new Error('Incoming Loro snapshot has an incompatible binding descriptor.');
      }
      const model = new LoroCanonicalDocument(candidate, this.descriptor, { initialize: false });
      const seenNodeIds = new Set<string>();
      const inlineIds = new Set<string>();
      const incomingNodes = model.getNodes().map((node) => ({ data: model.readNode(node), node }));
      incomingNodes.forEach(({ data }) => {
        if (typeof data.properties.inlineId === 'string') inlineIds.add(data.properties.inlineId);
      });
      for (const { data, node } of incomingNodes) {
        if (!this.capabilities.has(data.type)) {
          throw new Error(`No Loro capability registered for incoming node type ${data.type}.`);
        }
        const parent = node.parent();
        const parentType = parent ? model.readNode(parent).type : undefined;
        if (!isCapabilityParentAllowed(this.capabilities.get(data.type)!, parentType)) {
          throw new Error(`Illegal Loro parent for incoming node type ${data.type}.`);
        }
        if (!data.nodeId) {
          throw new Error(`Incoming Loro node ${data.type} has no durable nodeId.`);
        }
        if (data.flow) {
          const flow = readLoroFlow(data.flow);
          validateLoroFlowSnapshot(flow, { allowInline: true });
          for (const item of flow.delta) {
            for (const key of Object.keys(item.attributes ?? {})) {
              const prefix = key.startsWith('loro_inline_')
                ? 'loro_inline_'
                : key.startsWith('loro_atom_')
                  ? 'loro_atom_'
                  : null;
              if (prefix && !inlineIds.has(key.slice(prefix.length))) {
                throw new Error(`Incoming Loro flow references unknown inline identity ${key}.`);
              }
            }
          }
        }
        if (seenNodeIds.has(data.nodeId)) {
          throw new Error(`Incoming Loro document has duplicate durable nodeId ${data.nodeId}.`);
        }
        seenNodeIds.add(data.nodeId);
      }
    } finally {
      candidate.free();
    }
  }

  exportSnapshot(): Uint8Array {
    return this.canonical.exportSnapshot();
  }

  exportUpdate() {
    return this.canonical.exportUpdate();
  }

  undo(): boolean {
    if (!this.isHistoryWritable()) return false;
    this.finishHistoryGroup();
    this.undoManager.setMergeInterval(this.historyMergeInterval);
    this.pendingHistoryInterval = null;
    this.forceNextHistoryInterval = null;
    this.historyPushPending = false;
    this.historyForcedCommitPending = false;
    this.pendingLocalHistoryBefore = undefined;
    this.pendingLocalHistoryAfter = undefined;
    this.undoProjection = true;
    try {
      const result = this.undoManager.undo();
      if (result) this.flushPendingHistoryProjection();
      if (!result) this.pendingHistorySelection = undefined;
      return result;
    } finally {
      this.undoProjection = false;
    }
  }

  redo(): boolean {
    if (!this.isHistoryWritable()) return false;
    this.finishHistoryGroup();
    this.undoManager.setMergeInterval(this.historyMergeInterval);
    this.pendingHistoryInterval = null;
    this.forceNextHistoryInterval = null;
    this.historyPushPending = false;
    this.historyForcedCommitPending = false;
    this.undoProjection = true;
    try {
      const result = this.undoManager.redo();
      if (result) this.flushPendingHistoryProjection();
      if (!result) this.pendingHistorySelection = undefined;
      return result;
    } finally {
      this.undoProjection = false;
    }
  }

  captureSelection(): LoroSelectionSnapshot | null {
    return this.captureSelectionFromEditorState(this.editor.getEditorState());
  }

  private onHistoryPush(
    _isUndo: boolean,
    counterRange: { start: number; end: number },
  ): { cursors: Cursor[]; value: Value } {
    const pending = this.pendingSyntheticHistoryPush ?? this.pendingHistoryPush;
    this.pendingSyntheticHistoryPush = null;
    this.pendingHistoryPush = null;
    if (!pending) return { cursors: [], value: null };
    const key = this.historyCounterRangeKey(counterRange);
    this.lastHistoryPushKey = key;
    this.historySelectionOverrides.set(key, pending.value);
    return { cursors: pending.cursors, value: pending.value as unknown as Value };
  }

  private onHistoryPop(
    isUndo: boolean,
    value: { cursors: Cursor[]; value: unknown },
    counterRange: { start: number; end: number },
  ): void {
    const entry =
      this.historySelectionOverrides.get(this.historyCounterRangeKey(counterRange)) ??
      (value.value as Partial<HistorySelectionValue> | null);
    if (!entry || entry.version !== 1) {
      this.pendingHistorySelection = undefined;
      return;
    }
    const selected = isUndo ? entry.before : entry.after;
    const transformedSelection = this.selectionFromHistoryCursors(selected ?? null, value.cursors);
    const originalSelection = this.selectionFromHistoryCursors(
      selected ?? null,
      this.decodeHistoryCursors(selected ?? null),
    );
    this.pendingHistorySelection = isUndo
      ? transformedSelection
      : this.historySelectionOffsetsDiffer(originalSelection, transformedSelection)
        ? transformedSelection
        : originalSelection;
    const syntheticSelection = isUndo ? entry.after : entry.before;
    this.pendingSyntheticHistoryPush = {
      cursors: this.decodeHistoryCursors(syntheticSelection ?? null),
      value: {
        after: entry.after ?? null,
        before: entry.before ?? null,
        version: 1,
      },
    };
  }

  private historyCounterRangeKey(counterRange: { start: number; end: number }): string {
    return `${counterRange.start}:${counterRange.end}`;
  }

  private historySelectionOffsetsDiffer(
    left: LoroSelectionSnapshot | null,
    right: LoroSelectionSnapshot | null,
  ): boolean {
    if (!left || !right) return left !== right;
    const offset = (point: LoroSelectionPoint): number | null =>
      this.canonical.doc.getCursorPos(Cursor.decode(point.encodedCursor))?.offset ?? null;
    return (
      offset(left.anchor) !== offset(right.anchor) || offset(left.focus) !== offset(right.focus)
    );
  }

  private decodeHistoryCursors(selection: LoroSelectionSnapshot | null): Cursor[] {
    if (!selection) return [];
    try {
      return [
        Cursor.decode(selection.anchor.encodedCursor),
        Cursor.decode(selection.focus.encodedCursor),
      ];
    } catch {
      return [];
    }
  }

  private selectionFromHistoryCursors(
    selection: LoroSelectionSnapshot | null,
    cursors: readonly Cursor[],
  ): LoroSelectionSnapshot | null {
    if (!selection || cursors.length < 2) return selection;
    const point = (original: LoroSelectionPoint, cursor: Cursor): LoroSelectionPoint => {
      const resolved = this.canonical.doc.getCursorPos(cursor);
      return {
        containerId: original.containerId,
        encodedCursor: cursor.encode(),
        flowNodeId: original.flowNodeId,
        side: resolved?.side === -1 || resolved?.side === 1 ? resolved.side : original.side,
      };
    };
    return {
      anchor: point(selection.anchor, cursors[0]),
      backward: selection.backward,
      focus: point(selection.focus, cursors[1]),
    };
  }

  private captureSelectionFromEditorState(editorState: EditorState): LoroSelectionSnapshot | null {
    return editorState.read(() => {
      const selection = $getSelection();
      if (!$isRangeSelection(selection)) return null;
      const anchor = this.capturePoint(selection.anchor);
      const focus = this.capturePoint(selection.focus);
      if (!anchor || !focus) return null;
      return { anchor, backward: selection.isBackward(), focus };
    });
  }

  logicalOffsetToFlowOffset(nodeId: string, logicalOffset: number): number | null {
    return this.mapFlowOffsets(nodeId, logicalOffset, 'logical-to-flow');
  }

  flowOffsetToLogicalOffset(nodeId: string, flowOffset: number): number | null {
    return this.mapFlowOffsets(nodeId, flowOffset, 'flow-to-logical');
  }

  private mapFlowOffsets(
    nodeId: string,
    targetOffset: number,
    direction: 'flow-to-logical' | 'logical-to-flow',
  ): number | null {
    return this.editor.getEditorState().read(() => {
      let owner: ElementNode | null = null;
      const visit = (node: LexicalNode): void => {
        if (owner) return;
        if ($getNodeId(node) === nodeId && $isElementNode(node)) {
          owner = node;
          return;
        }
        directLogicalChildren(node).forEach(visit);
      };
      visit($getRoot());
      if (!owner) return null;
      const flowOwner = owner as ElementNode;
      let logical = 0;
      let flow = 0;
      const target = Math.max(0, targetOffset);
      let result: number | null = null;
      const consume = (node: LexicalNode): void => {
        if (result !== null) return;
        if ($isCursorNode(node)) return;
        if ($isTextNode(node)) {
          const length = node.getTextContentSize();
          if (direction === 'logical-to-flow' && target <= logical + length) {
            result = flow + target - logical;
            return;
          }
          if (direction === 'flow-to-logical' && target <= flow + length) {
            result = logical + target - flow;
            return;
          }
          logical += length;
          flow += length;
          return;
        }
        if ($isLineBreakNode(node)) {
          if (target <= (direction === 'logical-to-flow' ? logical : flow)) {
            result = direction === 'logical-to-flow' ? flow : logical;
            return;
          }
          logical += 1;
          flow += 1;
          return;
        }
        if ($isElementNode(node) && node.isInline()) {
          node.getChildren().forEach(consume);
          return;
        }
        if ($isDecoratorNode(node) && node.isInline()) {
          const logicalLength = node.getTextContentSize();
          if (direction === 'logical-to-flow' && target <= logical + logicalLength) {
            result = target === logical ? flow : flow + 1;
            return;
          }
          if (direction === 'flow-to-logical' && target <= flow + 1) {
            result = target === flow ? logical : logical + logicalLength;
            return;
          }
          logical += logicalLength;
          flow += 1;
        }
      };
      flowOwner.getChildren().forEach(consume);
      if (result !== null) return result;
      return direction === 'logical-to-flow' ? flow : logical;
    });
  }

  restoreSelection(snapshot: LoroSelectionSnapshot | null): void {
    if (this.disposed) return;
    this.editor.update(() => this.restoreSelectionInCurrentUpdate(snapshot), {
      discrete: true,
      tag: LORO_REMOTE_TAG,
    });
  }

  private restoreSelectionInCurrentUpdate(snapshot: LoroSelectionSnapshot | null): void {
    const resolved = snapshot
      ? {
          anchor: this.resolveSelectionPoint(snapshot.anchor),
          focus: this.resolveSelectionPoint(snapshot.focus),
        }
      : null;
    if (resolved?.anchor && resolved.focus) {
      const selection = $createRangeSelection();
      selection.setTextNodeRange(
        resolved.anchor.node,
        resolved.anchor.offset,
        resolved.focus.node,
        resolved.focus.offset,
      );
      $setSelection(selection);
      return;
    }
    this.normalizeLexicalSelection();
  }

  private normalizeLexicalSelection(): void {
    const selection = $getSelection();
    if (!$isRangeSelection(selection)) return;
    const normalizePoint = (point: { getNode: () => LexicalNode; offset: number }) => {
      const node = point.getNode();
      if (!$isTextNode(node)) return null;
      return { node, offset: Math.min(point.offset, node.getTextContentSize()) };
    };
    const anchor = normalizePoint(selection.anchor);
    const focus = normalizePoint(selection.focus);
    if (!anchor || !focus) return;
    const normalized = $createRangeSelection();
    normalized.setTextNodeRange(anchor.node, anchor.offset, focus.node, focus.offset);
    $setSelection(normalized);
  }

  dispose(): void {
    if (this.disposed) return;
    this.finishHistoryGroup();
    this.undoManager.setMergeInterval(this.historyMergeInterval);
    this.pendingHistoryInterval = null;
    this.forceNextHistoryInterval = null;
    this.historyPushPending = false;
    this.historyForcedCommitPending = false;
    this.pendingLocalHistoryBefore = undefined;
    this.pendingLocalHistoryAfter = undefined;
    this.historySelectionOverrides.clear();
    this.lastHistoryPushKey = null;
    this.disposed = true;
    this.phase = 'disposed';
    this.unsubscribeLexical();
    this.unsubscribeLoro();
    this.unregisterProperties?.();
    this.propertiesProvider.dispose();
    this.undoManager.free();
    this.readinessListeners.clear();
  }

  private onLexicalUpdate(
    editorState: EditorState,
    tags: Set<string>,
    previousEditorState: EditorState | null,
  ): void {
    if (
      this.disposed ||
      this.phase === 'incompatible' ||
      (this.phase === 'initializing' && !this.allowInitializationSync) ||
      this.applyingLoro > 0 ||
      tags.has(LORO_REMOTE_TAG)
    )
      return;
    try {
      const historyTags = new Set(tags);
      const previousShape = previousEditorState
        ? this.structuralShape(previousEditorState)
        : undefined;
      const nextShape = this.structuralShape(editorState);
      if (previousShape !== undefined && previousShape !== nextShape) {
        historyTags.add(HISTORY_PUSH_TAG);
      }
      this.prepareHistoryUpdate(historyTags);
      if (this.pendingLocalHistoryBefore === undefined) {
        this.pendingLocalHistoryBefore = previousEditorState
          ? this.captureSelectionFromEditorState(previousEditorState)
          : null;
      }
      if (this.pendingLocalHistoryAfter === undefined) {
        this.pendingLocalHistoryAfter = this.captureSelectionFromEditorState(editorState);
      }
      const missingIdentityRepair = editorState.read(() => {
        let missingNodeIds = false;
        let missingSyntheticIds = false;
        let missingInlineIds = false;
        const visit = (node: LexicalNode): void => {
          if (missingNodeIds && missingSyntheticIds && missingInlineIds) return;
          for (const child of directLogicalChildren(node).filter(isStructuralNode)) {
            if ($isNodeIdentityTarget(child) && !$getNodeId(child)) missingNodeIds = true;
            if (
              requiresSyntheticCapabilityIdentity(child.getType()) &&
              typeof $getNodeProperties(child).diffId !== 'string'
            ) {
              missingSyntheticIds = true;
            }
            const capability = this.capabilities.get(child.getType());
            if (
              capability &&
              (capability.role === 'inline' || capability.role === 'atom') &&
              typeof $getNodeProperties(child).inlineId !== 'string'
            ) {
              missingInlineIds = true;
            }
            visit(child);
          }
        };
        visit($getRoot());
        return { missingInlineIds, missingNodeIds, missingSyntheticIds };
      });
      if (
        missingIdentityRepair.missingInlineIds ||
        missingIdentityRepair.missingNodeIds ||
        missingIdentityRepair.missingSyntheticIds
      ) {
        this.editor.update(
          () => {
            $ensureNodeIdsInTree();
            this.ensureSyntheticCapabilityIds();
            this.ensureInlineCapabilityIds();
          },
          { tag: LORO_LOCAL_TAG },
        );
        return;
      }
      this.syncLexicalToLoro(editorState);
    } catch (error) {
      this.undoManager.setMergeInterval(this.historyMergeInterval);
      this.pendingHistoryInterval = null;
      this.forceNextHistoryInterval = null;
      this.historyPushPending = false;
      this.historyForcedCommitPending = false;
      this.pendingLocalHistoryBefore = undefined;
      this.pendingLocalHistoryAfter = undefined;
      this.pendingHistoryPush = null;
      this.pendingSyntheticHistoryPush = null;
      this.phase = 'incompatible';
      this.notifyReadiness();
      throw error;
    }
  }

  private isHistoryWritable(): boolean {
    return !this.disposed && this.phase !== 'incompatible' && this.editor.isEditable();
  }

  private structuralShape(editorState: EditorState): string {
    return editorState.read(() => {
      const visit = (node: LexicalNode): string =>
        `${node.getType()}(${directLogicalChildren(node)
          .filter(isStructuralNode)
          .map(visit)
          .join(',')})`;
      return visit($getRoot());
    });
  }

  private syncLexicalToLoro(editorState: EditorState): void {
    editorState.read(() => this.preflightLexicalTree($getRoot()));
    const seen = new Set<string>();
    if (this.pendingLocalHistoryAfter === undefined) {
      this.pendingLocalHistoryAfter = this.captureSelection();
    }
    this.pendingHistoryPush = {
      cursors: this.decodeHistoryCursors(this.pendingLocalHistoryBefore ?? null),
      value: {
        after: this.pendingLocalHistoryAfter ?? null,
        before: this.pendingLocalHistoryBefore ?? null,
        version: 1,
      },
    };
    this.canonical.commit(
      () => {
        editorState.read(() => {
          this.syncChildren($getRoot(), undefined, seen);
        });

        // Only remove nodes that this binding projected or created. A node that
        // arrived remotely but has not yet been projected must never be deleted
        // by a stale local Lexical snapshot.
        for (const [nodeId, entry] of this.projectionCache) {
          const canonicalNode = this.canonical.getNode(entry.treeId);
          if (!seen.has(nodeId) && canonicalNode && !canonicalNode.isDeleted()) {
            this.canonical.deleteNode(entry.treeId);
            this.projectionCache.delete(nodeId);
          }
        }
      },
      { origin: 'loro:lexical/local' },
    );
    this.pendingHistoryPush = null;
    if (this.lastHistoryPushKey) {
      const currentEntry = this.historySelectionOverrides.get(this.lastHistoryPushKey);
      const after = this.captureSelectionFromEditorState(editorState) ?? this.captureSelection();
      if (currentEntry && after) currentEntry.after = after;
    }
    this.pendingLocalHistoryBefore = undefined;
    this.pendingLocalHistoryAfter = undefined;
    if (this.pendingHistoryInterval !== null) {
      const pushCommit = this.historyPushPending;
      const forcedCommit = this.historyForcedCommitPending;
      this.pendingHistoryInterval = null;
      this.historyPushPending = false;
      this.historyForcedCommitPending = false;
      if (pushCommit) {
        this.forceNextHistoryInterval = 0;
        this.undoManager.setMergeInterval(0);
      } else if (forcedCommit) {
        this.forceNextHistoryInterval = null;
        this.undoManager.setMergeInterval(this.historyMergeInterval);
      } else {
        this.undoManager.setMergeInterval(this.historyMergeInterval);
      }
    }
    this.hasAcceptedInitialSnapshot = true;
    this.setReady();
  }

  private preflightLexicalTree(node: LexicalNode): void {
    this.preflightLexicalTreeWithIds(node, new Set());
  }

  private preflightLexicalTreeWithIds(node: LexicalNode, seenIds: Set<string>): void {
    for (const child of directLogicalChildren(node).filter(isStructuralNode)) {
      const nodeId = this.readOrRequireIdentity(child);
      if (seenIds.has(nodeId)) {
        throw new Error(`Duplicate durable nodeId ${nodeId} in the Lexical tree.`);
      }
      seenIds.add(nodeId);
      const capability = this.capabilities.get(child.getType());
      if (!capability) {
        throw new Error(`No Loro capability registered for node type ${child.getType()}.`);
      }
      const parentType = node.getType() === 'root' ? undefined : node.getType();
      if (!isCapabilityParentAllowed(capability, parentType)) {
        throw new Error(`Illegal Lexical parent for node type ${child.getType()}.`);
      }
      if (this.isFlowOwner(child)) {
        // Read before any Loro transaction so unsupported inline decorators do
        // not leave a half-written canonical tree.
        readLexicalFlow(child);
        this.preflightStructuralChildren(child, seenIds);
      } else {
        this.preflightLexicalTreeWithIds(child, seenIds);
      }
      void nodeId;
    }
  }

  private ensureSyntheticCapabilityIds(): void {
    const visit = (node: LexicalNode): void => {
      for (const child of directLogicalChildren(node).filter(isStructuralNode)) {
        if (
          requiresSyntheticCapabilityIdentity(child.getType()) &&
          typeof $getNodeProperties(child).diffId !== 'string'
        ) {
          $setNodeProperties(child, (previous) => ({
            ...previous,
            diffId: createNodeId(),
          }));
        }
        visit(child);
      }
    };
    visit($getRoot());
  }

  private ensureInlineCapabilityIds(): void {
    const visit = (node: LexicalNode): void => {
      for (const child of directLogicalChildren(node).filter(isStructuralNode)) {
        const capability = this.capabilities.get(child.getType());
        if (
          capability &&
          (capability.role === 'inline' || capability.role === 'atom') &&
          typeof $getNodeProperties(child).inlineId !== 'string'
        ) {
          $setNodeProperties(child, (previous) => ({
            ...previous,
            inlineId: createNodeId(),
          }));
        }
        visit(child);
      }
    };
    visit($getRoot());
  }

  private preflightStructuralChildren(node: LexicalNode, seenIds: Set<string>): void {
    for (const child of directLogicalChildren(node).filter(isStructuralNode)) {
      const nodeId = this.readOrRequireIdentity(child);
      if (seenIds.has(nodeId)) {
        throw new Error(`Duplicate durable nodeId ${nodeId} in the Lexical tree.`);
      }
      seenIds.add(nodeId);
      const capability = this.capabilities.get(child.getType());
      if (!capability) {
        throw new Error(`No Loro capability registered for node type ${child.getType()}.`);
      }
      const parentType = node.getType() === 'root' ? undefined : node.getType();
      if (!isCapabilityParentAllowed(capability, parentType)) {
        throw new Error(`Illegal Lexical parent for node type ${child.getType()}.`);
      }
      if (this.isFlowOwner(child)) {
        readLexicalFlow(child);
        this.preflightStructuralChildren(child, seenIds);
      } else {
        this.preflightLexicalTreeWithIds(child, seenIds);
      }
    }
  }

  private syncChildren(
    parent: LexicalNode,
    parentTreeId: TreeID | undefined,
    seen: Set<string>,
  ): void {
    const children = directLogicalChildren(parent).filter(isStructuralNode);
    children.forEach((child, structuralIndex) =>
      this.syncNode(child, parentTreeId, structuralIndex, seen),
    );
  }

  private syncNode(
    child: LexicalNode,
    parentTreeId: TreeID | undefined,
    structuralIndex: number,
    seen: Set<string>,
  ): void {
    const nodeId = this.readOrRequireIdentity(child);
    seen.add(nodeId);
    const existing = this.canonical.findNodeById(nodeId);
    const role = nodeRole(child);
    const attrs = readNodeAttrs(child);
    const properties = clone($getNodeProperties(child));
    const flow = this.isFlowOwner(child) ? readLexicalFlow(child) : undefined;
    const body = readEmbeddedBody(child);
    let canonicalNode = existing;

    if (!canonicalNode) {
      canonicalNode = this.canonical.createNode({
        attrs,
        body,
        flow: flow?.text,
        nodeId,
        parent: parentTreeId,
        properties,
        role,
        type: child.getType(),
        index: structuralIndex,
      });
      if (flow) updateLoroFlow(this.canonical.doc, getAttachedText(canonicalNode, 'flow')!, flow);
    } else {
      const cache = this.projectionCache.get(nodeId);
      const oldParent = parentTreeIdOf(canonicalNode);
      if (
        oldParent !== parentTreeId ||
        !this.sameSiblingPosition(canonicalNode, parentTreeId, structuralIndex)
      ) {
        this.canonical.moveNode(canonicalNode.id, parentTreeId, structuralIndex);
      }
      this.patchNodeFields(canonicalNode, nodeId, attrs, properties, body, flow, cache);
    }

    this.cacheNode(nodeId, canonicalNode, parentTreeId, attrs, properties, body, flow);
    if (flow) this.syncChildrenWithoutFlowText(child, canonicalNode.id, seen);
    else this.syncChildren(child, canonicalNode.id, seen);
  }

  private syncChildrenWithoutFlowText(
    node: LexicalNode,
    parentTreeId: TreeID,
    seen: Set<string>,
  ): void {
    directLogicalChildren(node)
      .filter(
        (child) => isStructuralNode(child) && !($isTextNode(child) || $isLineBreakNode(child)),
      )
      .forEach((child, structuralIndex) =>
        this.syncNode(child, parentTreeId, structuralIndex, seen),
      );
  }

  private patchNodeFields(
    node: LoroTreeNode,
    nodeId: string,
    attrs: Record<string, unknown>,
    properties: Record<string, unknown>,
    body: string | undefined,
    flow: ReturnType<typeof readLexicalFlow> | undefined,
    cache: ProjectionCacheEntry | undefined,
  ): void {
    const changedAttrs: Record<string, unknown> = {};
    const changedProperties: Record<string, unknown> = {};
    const deletedAttrs: string[] = [];
    const deletedProperties: string[] = [];
    for (const [key, value] of Object.entries(attrs)) {
      if (!cache || !sameRecordValue(cache.attrs[key], value)) changedAttrs[key] = value;
    }
    for (const [key, value] of Object.entries(properties)) {
      if (!cache || !sameRecordValue(cache.properties[key], value)) changedProperties[key] = value;
    }
    for (const key of Object.keys(cache?.attrs ?? {})) if (!(key in attrs)) deletedAttrs.push(key);
    for (const key of Object.keys(cache?.properties ?? {})) {
      if (!(key in properties)) deletedProperties.push(key);
    }
    this.canonical.updateNodeFields(node, {
      ...(Object.keys(changedAttrs).length > 0 ? { attrs: changedAttrs } : {}),
      ...(Object.keys(changedProperties).length > 0 ? { properties: changedProperties } : {}),
    });
    if (deletedAttrs.length > 0) this.canonical.deleteMapFields(node, 'attrs', deletedAttrs);
    if (deletedProperties.length > 0)
      this.canonical.deleteMapFields(node, 'properties', deletedProperties);

    const canonicalFlow = getAttachedText(node, 'flow');
    if (flow && canonicalFlow) {
      const previous = cache?.flow ?? readLoroFlow(canonicalFlow);
      updateLoroFlow(this.canonical.doc, canonicalFlow, flow, previous);
    }
    if (body !== undefined) {
      const canonicalBody = getAttachedText(node, 'body');
      if (canonicalBody && canonicalBody.toString() !== body) this.canonical.updateBody(node, body);
    }
    void nodeId;
  }

  private cacheNode(
    nodeId: string,
    node: LoroTreeNode,
    parent: TreeID | undefined,
    attrs: Record<string, unknown>,
    properties: Record<string, unknown>,
    body: string | undefined,
    flow: ReturnType<typeof readLexicalFlow> | undefined,
  ): void {
    this.projectionCache.set(nodeId, {
      attrs: clone(attrs),
      ...(body !== undefined ? { body } : {}),
      ...(flow ? { flow: clone(flow) } : {}),
      parentTreeId: parent,
      properties: clone(properties),
      treeId: node.id,
    });
  }

  private readOrRequireIdentity(node: LexicalNode): string {
    if ($isNodeIdentityTarget(node)) {
      const id = $getNodeId(node);
      if (id) return id;
    }
    const properties = $getNodeProperties(node);
    if (requiresSyntheticCapabilityIdentity(node.getType())) {
      if (typeof properties.diffId === 'string' && properties.diffId.length > 0) {
        return `diff:${properties.diffId}`;
      }
      throw new Error(`Loro node ${node.getType()} has no durable diff identity.`);
    }
    const inlineId = properties.inlineId;
    if (typeof inlineId === 'string' && inlineId.length > 0) return `inline:${inlineId}`;
    throw new Error(`Loro node ${node.getType()} has no durable identity.`);
  }

  private sameSiblingPosition(
    node: LoroTreeNode,
    parent: TreeID | undefined,
    index: number,
  ): boolean {
    if (parentTreeIdOf(node) !== parent) return false;
    const siblings = parent
      ? (this.canonical.getNode(parent)?.children() ?? [])
      : this.canonical.tree.roots();
    return siblings.findIndex((candidate) => candidate.id === node.id) === index;
  }

  private onLoroEvent(event: LoroEventBatch): void {
    if (this.disposed) return;
    if (event.by === 'import') {
      this.finishHistoryGroup();
      this.undoManager.setMergeInterval(this.historyMergeInterval);
      this.pendingHistoryInterval = null;
      this.forceNextHistoryInterval = null;
      this.historyPushPending = false;
      this.historyForcedCommitPending = false;
    }
    if (event.by === 'local' && !this.undoProjection) return;
    if (event.by === 'import' && this.controlledImportDepth === 0) {
      this.phase = 'incompatible';
      this.notifyReadiness();
      // Loro dispatches subscriber errors asynchronously through WASM. Do not
      // throw from this callback: isolate the binding and leave the Lexical
      // projection untouched, so a raw external import cannot look supported
      // or create an unhandled rejection. Callers must use applyUpdate().
      return;
    }
    const preservedSelection =
      event.by === 'import' && this.controlledImportDepth > 0
        ? this.pendingImportSelection
        : event.by === 'local' && this.undoProjection
          ? null
          : undefined;
    if (event.by === 'import' && this.controlledImportDepth > 0) {
      this.pendingImportSelection = undefined;
    }
    this.indexCanonicalEvent(event);
    if (event.by === 'local' && this.undoProjection) {
      this.pendingHistoryProjection = true;
      return;
    }
    this.projectCanonicalToLexical(preservedSelection);
  }

  private flushPendingHistoryProjection(): void {
    if (!this.pendingHistoryProjection || this.disposed) return;
    this.pendingHistoryProjection = false;
    this.projectCanonicalToLexical(null);
  }

  finishHistoryGroup(): void {
    if (this.disposed) return;
    this.undoManager.groupEnd();
  }

  private indexCanonicalEvent(event: LoroEventBatch): void {
    for (const change of event.events) {
      if (change.target === this.canonical.tree.id) {
        this.pendingTreeProjection = true;
        continue;
      }
      for (const node of this.canonical.getNodes()) {
        if (node.data.id === change.target) {
          this.pendingNodeProjection.add(node.id);
          continue;
        }
        const flow = getAttachedText(node, 'flow');
        const body = getAttachedText(node, 'body');
        const attrs = getAttachedMap(node, 'attrs');
        const properties = getAttachedMap(node, 'properties');
        if (flow?.id === change.target) {
          this.pendingNodeProjection.add(node.id);
          this.pendingFlowProjection.add(node.id);
        }
        if (body?.id === change.target) this.pendingNodeProjection.add(node.id);
        if (attrs?.id === change.target || properties?.id === change.target) {
          this.pendingNodeProjection.add(node.id);
        }
      }
    }
  }

  private projectCanonicalToLexical(
    preservedSelection: LoroSelectionSnapshot | null | undefined = this.captureSelection(),
  ): void {
    const fullTree = this.pendingTreeProjection || this.lexicalByNodeId.size === 0;
    const dirtyNodes = new Set(this.pendingNodeProjection);
    const dirtyFlows = new Set(this.pendingFlowProjection);
    const historySelection = this.pendingHistorySelection;
    this.pendingHistorySelection = undefined;
    const selectionToRestore =
      historySelection !== undefined ? historySelection : preservedSelection;
    this.pendingTreeProjection = false;
    this.pendingNodeProjection.clear();
    this.pendingFlowProjection.clear();
    this.applyingLoro += 1;
    try {
      this.editor.update(
        () => {
          const root = $getRoot();
          this.indexLexicalTree(root);
          if (fullTree) this.projectChildren(root, undefined);
          else this.projectDirtyFields(dirtyNodes, dirtyFlows);
          getKernelFromEditor(this.editor)?.requireService(IHoleService)?.normalizeIncoming();
          this.purgeDeletedProjectionCache();
          this.restoreSelectionInCurrentUpdate(selectionToRestore);
        },
        {
          discrete: true,
          onUpdate: () => this.setReady(),
          tag: LORO_REMOTE_TAG,
        },
      );
    } catch (error) {
      this.phase = 'incompatible';
      this.notifyReadiness();
      throw error;
    } finally {
      this.applyingLoro -= 1;
    }
  }

  private indexLexicalTree(root: LexicalNode): void {
    this.lexicalByNodeId.clear();
    const visit = (node: LexicalNode): void => {
      const nodeId = $getNodeId(node);
      if (nodeId) this.lexicalByNodeId.set(nodeId, node);
      directLogicalChildren(node).forEach(visit);
    };
    visit(root);
  }

  private projectDirtyFields(dirtyNodes: Set<TreeID>, dirtyFlows: Set<TreeID>): void {
    for (const treeId of dirtyNodes) {
      const canonicalNode = this.canonical.getNode(treeId);
      if (!canonicalNode || canonicalNode.isDeleted()) continue;
      const data = this.canonical.readNode(canonicalNode);
      const lexical = data.nodeId ? this.lexicalByNodeId.get(data.nodeId) : undefined;
      if (!lexical) {
        this.pendingTreeProjection = true;
        continue;
      }
      const currentProperties = $getNodeProperties(lexical);
      const previousProperties = data.nodeId
        ? this.projectionCache.get(data.nodeId)?.properties
        : undefined;
      const projectedProperties = { ...currentProperties, ...data.properties };
      for (const key of Object.keys(previousProperties ?? {})) {
        if (!(key in data.properties)) delete projectedProperties[key];
      }
      $setNodeProperties(lexical, {
        ...projectedProperties,
        ...(data.nodeId ? { nodeId: data.nodeId } : {}),
      });
      this.applyAttrs(
        lexical,
        data.attrs,
        data.nodeId ? this.projectionCache.get(data.nodeId)?.attrs : undefined,
      );
      this.applyBody(lexical, data.body?.toString());
      if (dirtyFlows.has(treeId) && $isElementNode(lexical) && data.flow) {
        this.projectFlowChildren(
          lexical,
          readLoroFlow(data.flow).delta,
          this.visibleChildren(treeId),
        );
      }
      this.cacheNode(
        data.nodeId ?? '',
        canonicalNode,
        parentTreeIdOf(canonicalNode),
        data.attrs,
        data.properties,
        data.body?.toString(),
        data.flow ? readLoroFlow(data.flow) : undefined,
      );
    }
  }

  private purgeDeletedProjectionCache(): void {
    for (const [nodeId, entry] of this.projectionCache) {
      const canonicalNode = this.canonical.getNode(entry.treeId);
      if (!canonicalNode || canonicalNode.isDeleted()) {
        this.projectionCache.delete(nodeId);
        this.lexicalByNodeId.delete(nodeId);
      }
    }
  }

  private projectChildren(parent: ElementNode, parentTreeId: TreeID | undefined): void {
    const flowOwner = this.isFlowOwner(parent);
    const allRecords = this.visibleChildren(parentTreeId);
    const records = flowOwner
      ? allRecords.filter((record) => record.role !== 'inline' && record.role !== 'atom')
      : allRecords;
    const isCanonicalChild = (nodeId: string | undefined): boolean => {
      if (!nodeId) return false;
      const canonicalNode = this.canonical.findNodeById(nodeId);
      return Boolean(canonicalNode && parentTreeIdOf(canonicalNode) === parentTreeId);
    };

    const enclosingHole = (node: LexicalNode): LexicalNode | null => {
      let current = node.getParent();
      let top: LexicalNode | null = null;
      while (current && !current.is(parent)) {
        if ($isHoleNode(current)) top = current;
        current = current.getParent();
      }
      return top && top.getParent()?.is(parent) ? top : null;
    };

    for (const child of parent.getChildren()) {
      if ($isHoleNode(child)) {
        for (const payload of child.getContentChildren()) {
          if (!isCanonicalChild($getNodeId(payload))) payload.remove();
        }
        if (child.getContentChildren().length === 0) child.remove();
        continue;
      }
      if (flowOwner && ($isTextNode(child) || $isLineBreakNode(child))) continue;
      const nodeId = $getNodeId(child);
      if (!isCanonicalChild(nodeId)) child.remove();
    }

    const seenHoles = new Set<string>();
    for (const record of records) {
      let lexical = record.nodeId ? this.lexicalByNodeId.get(record.nodeId) : undefined;
      if (
        !lexical ||
        lexical.getType() !== record.type ||
        !this.isNodeShapeCompatible(lexical, record)
      ) {
        lexical = this.createLexicalNode(record);
        const previous = record.nodeId ? this.lexicalByNodeId.get(record.nodeId) : null;
        if (previous?.isAttached()) previous.replace(lexical);
        else parent.append(lexical);
      } else if (record.nodeId && enclosingHole(lexical)?.getParent()?.is(parent)) {
        // Hole is a runtime wrapper. Keep an existing payload in its wrapper
        // while projecting the canonical child; only the wrapper participates
        // in physical ordering, and the payload order is repaired before its
        // trailing boundary cursor.
        const hole = enclosingHole(lexical);
        if (hole && !seenHoles.has(hole.getKey())) {
          parent.append(hole);
          seenHoles.add(hole.getKey());
        }
        if ($isHoleNode(hole)) {
          const after = hole.getAfterCursor();
          if (after && !lexical.is(after)) after.insertBefore(lexical);
        }
      } else if (!lexical.getParent()?.is(parent)) {
        const oldParent = lexical.getParent();
        const oldHole = oldParent && $isHoleNode(oldParent) ? oldParent : null;
        parent.append(lexical);
        if (oldHole && oldHole.getContentChildren().length === 0) oldHole.remove();
      } else {
        // append() is a keyed move; it also repairs a same-parent concurrent
        // reorder without replacing the node or its Lexical NodeKey.
        parent.append(lexical);
      }
      if (record.nodeId) this.lexicalByNodeId.set(record.nodeId, lexical);
      $setNodeProperties(lexical, {
        ...record.properties,
        ...(record.nodeId ? { nodeId: record.nodeId } : {}),
      });
      this.applyAttrs(
        lexical,
        record.attrs,
        record.nodeId ? this.projectionCache.get(record.nodeId)?.attrs : undefined,
      );
      this.applyBody(lexical, record.body?.toString());
      if ($isElementNode(lexical)) {
        if (record.flow) {
          this.projectFlowChildren(
            lexical,
            readLoroFlow(record.flow).delta,
            this.visibleChildren(record.treeId),
          );
        }
        this.projectChildren(lexical, record.treeId);
      }
      this.cacheNode(
        record.nodeId ?? '',
        this.canonical.getNode(record.treeId)!,
        parentTreeId,
        record.attrs,
        record.properties,
        record.body?.toString(),
        record.flow ? readLoroFlow(record.flow) : undefined,
      );
    }
  }

  private projectFlowChildren(
    owner: ElementNode,
    delta: ReturnType<typeof readLoroFlow>['delta'],
    records: LoroNodeData[],
  ): void {
    const inlineRecords = new Map<string, LoroNodeData>();
    for (const record of records) {
      const inlineId = record.properties.inlineId;
      if (typeof inlineId === 'string') inlineRecords.set(inlineId, record);
    }

    const projected: LexicalNode[] = [];
    const inlineNodes = new Map<string, ElementNode>();
    const initializedInline = new Set<string>();
    let lastInlineId: string | undefined;
    for (const item of delta) {
      const attributes = item.attributes ?? {};
      const inlineKeys = Object.keys(attributes).filter((key) => key.startsWith('loro_inline_'));
      const atomKeys = Object.keys(attributes).filter((key) => key.startsWith('loro_atom_'));
      if (
        inlineKeys.length > 1 ||
        atomKeys.length > 1 ||
        (inlineKeys.length > 0 && atomKeys.length > 0)
      ) {
        throw new Error('Overlapping inline identity marks cannot be projected as a Lexical tree.');
      }
      if (atomKeys.length > 0) {
        if (item.insert !== '\uFFFC') {
          throw new Error('Inline atom mark must cover exactly one object replacement character.');
        }
        const inlineId = atomKeys[0].slice('loro_atom_'.length);
        const record = inlineRecords.get(inlineId);
        if (!record) throw new Error(`Missing inline atom record ${inlineId}.`);
        projected.push(this.getOrCreateInlineNode(record));
        lastInlineId = undefined;
        continue;
      }
      if (inlineKeys.length > 0) {
        const inlineId = inlineKeys[0].slice('loro_inline_'.length);
        const record = inlineRecords.get(inlineId);
        if (!record) throw new Error(`Missing inline record ${inlineId}.`);
        if (inlineNodes.has(inlineId) && lastInlineId !== inlineId) {
          throw new Error(`Inline record ${inlineId} is split into non-contiguous flow ranges.`);
        }
        const inlineNode = (inlineNodes.get(inlineId) ??
          this.getOrCreateInlineNode(record)) as ElementNode;
        inlineNodes.set(inlineId, inlineNode);
        if (!$isElementNode(inlineNode)) {
          throw new Error(`Inline range record ${inlineId} is not an ElementNode.`);
        }
        if (!initializedInline.has(inlineId)) {
          inlineNode.getChildren().forEach((child) => {
            if (!$isCursorNode(child)) child.remove();
          });
          initializedInline.add(inlineId);
        }
        inlineNode.append(
          ...projectLoroFlow([
            {
              attributes: stripInlineFlowAttributes(attributes),
              insert: item.insert,
            },
          ]),
        );
        if (lastInlineId !== inlineId) projected.push(inlineNode);
        lastInlineId = inlineId;
        continue;
      }
      lastInlineId = undefined;
      projected.push(
        ...projectLoroFlow([
          { attributes: stripInlineFlowAttributes(attributes), insert: item.insert },
        ]),
      );
    }

    const children = owner.getChildren();
    const flowChildren = children.filter(
      (child) =>
        $isTextNode(child) ||
        $isLineBreakNode(child) ||
        (($isElementNode(child) || $isDecoratorNode(child)) && child.isInline()),
    );
    const firstIndex =
      flowChildren.length > 0 ? flowChildren[0].getIndexWithinParent() : children.length;
    const reused = new Set<LexicalNode>();
    const next = projected.map((candidate, index) => {
      const existing = flowChildren[index];
      if (
        $isTextNode(candidate) &&
        $isTextNode(existing) &&
        this.sameTextProjection(candidate, existing)
      ) {
        existing.setTextContent(candidate.getTextContent());
        reused.add(existing);
        return existing;
      }
      if ($isLineBreakNode(candidate) && $isLineBreakNode(existing)) {
        reused.add(existing);
        return existing;
      }
      if (!$isTextNode(candidate) && !$isLineBreakNode(candidate) && existing?.is(candidate)) {
        reused.add(existing);
        return existing;
      }
      return candidate;
    });
    for (const child of flowChildren) if (!reused.has(child)) child.remove();
    let insertionIndex = firstIndex;
    for (const candidate of next) {
      const current = owner.getChildAtIndex(insertionIndex);
      if (current?.is(candidate)) {
        insertionIndex += 1;
        continue;
      }
      if (current) current.insertBefore(candidate);
      else owner.append(candidate);
      insertionIndex += 1;
    }
  }

  private getOrCreateInlineNode(record: LoroNodeData): LexicalNode {
    const existing = record.nodeId ? this.lexicalByNodeId.get(record.nodeId) : undefined;
    const node =
      existing && existing.getType() === record.type ? existing : this.createLexicalNode(record);
    if (record.nodeId) this.lexicalByNodeId.set(record.nodeId, node);
    $setNodeProperties(node, {
      ...record.properties,
      ...(record.nodeId ? { nodeId: record.nodeId } : {}),
    });
    this.applyAttrs(node, record.attrs);
    return node;
  }

  private sameTextProjection(left: TextNode, right: TextNode): boolean {
    return (
      left.getFormat() === right.getFormat() &&
      left.getStyle() === right.getStyle() &&
      left.getDetail() === right.getDetail() &&
      left.getMode() === right.getMode() &&
      JSON.stringify($getNodeProperties(left)) === JSON.stringify($getNodeProperties(right))
    );
  }

  private visibleChildren(parent: TreeID | undefined): LoroNodeData[] {
    return this.canonical
      .getNodes()
      .filter((node) => parentTreeIdOf(node) === parent)
      .sort((left, right) => this.treeIndex(left) - this.treeIndex(right))
      .map((node) => this.canonical.readNode(node));
  }

  private treeIndex(node: LoroTreeNode): number {
    const parent = node.parent();
    const siblings = parent ? (parent.children() ?? []) : this.canonical.tree.roots();
    return siblings.findIndex((candidate) => candidate.id === node.id);
  }

  private createLexicalNode(data: LoroNodeData): LexicalNode {
    const capability = this.capabilities.get(data.type);
    if (!capability) throw new Error(`No Loro capability registered for node type ${data.type}.`);
    const node = capability.create(data);
    this.applyBody(node, data.body?.toString());
    return node;
  }

  private isNodeShapeCompatible(node: LexicalNode, data: LoroNodeData): boolean {
    if (node.getType() !== HeadingNode.getType() || typeof data.attrs.tag !== 'string') return true;
    return (node as InstanceType<typeof HeadingNode>).getTag() === data.attrs.tag;
  }

  private isFlowOwner(node: LexicalNode): node is ElementNode {
    return $isElementNode(node) && this.capabilities.get(node.getType())?.flowOwner === true;
  }

  private applyBody(node: LexicalNode, body: string | undefined): void {
    if (body === undefined) return;
    if (node.getType() === ArtifactNode.getType()) {
      const artifact = node as ArtifactNode;
      artifact.setHtml(body);
      return;
    }
    if (node.getType() === CodeMirrorNode.getType()) {
      (node as CodeMirrorNode).setCode(body);
    }
  }

  private applyAttrs(
    node: LexicalNode,
    attrs: Record<string, unknown>,
    previousAttrs: Record<string, unknown> = {},
  ): void {
    const hasAttr = (key: string): boolean => key in attrs || key in previousAttrs;

    if ($isElementNode(node)) {
      if (attrs.direction === null || attrs.direction === 'ltr' || attrs.direction === 'rtl') {
        node.setDirection(attrs.direction);
      }
      if (typeof attrs.format === 'string') node.setFormat(attrs.format as never);
      if (typeof attrs.indent === 'number') node.setIndent(attrs.indent);
    }
    if (node.getType() === HeadingNode.getType() && typeof attrs.tag === 'string') {
      (node as InstanceType<typeof HeadingNode>).setTag(attrs.tag as never);
    }
    if (node.getType() === 'code') {
      const candidate = node as LexicalNode & { setLang?: (value: string) => unknown };
      const language = attrs.language ?? attrs.lang;
      if (typeof language === 'string' && candidate.setLang) candidate.setLang(language);
      const codeMirror = node as CodeMirrorNode;
      const options = attrs.options;
      if (options && typeof options === 'object') {
        const value = options as Record<string, unknown>;
        if (typeof value.tabSize === 'number') codeMirror.setTabSize(value.tabSize);
        if (typeof value.indentWithTabs === 'boolean') {
          codeMirror.setIndentWithTabs(value.indentWithTabs);
        }
        if (typeof value.lineNumbers === 'boolean') codeMirror.setLineNumbers(value.lineNumbers);
      }
      if (typeof attrs.codeTheme === 'string') codeMirror.setCodeTheme(attrs.codeTheme);
    }
    if (node.getType() === ArtifactNode.getType() && typeof attrs.title === 'string')
      (node as ArtifactNode).setTitle(attrs.title);
    if (node.getType() === TableNode.getType()) {
      const table = node as TableNode;
      if (hasAttr('colWidths')) {
        table.setColWidths(
          Array.isArray(attrs.colWidths) ? (attrs.colWidths as number[]) : undefined,
        );
      }
      if (typeof attrs.rowStriping === 'boolean') table.setRowStriping(attrs.rowStriping);
      if (typeof attrs.frozenColumnCount === 'number') {
        table.setFrozenColumns(attrs.frozenColumnCount);
      }
      if (typeof attrs.frozenRowCount === 'number') table.setFrozenRows(attrs.frozenRowCount);
    }
    if (node.getType() === TableRowNode.getType()) {
      const row = node as TableRowNode;
      if (hasAttr('height')) {
        row.setHeight(typeof attrs.height === 'number' ? attrs.height : undefined);
      }
    }
    if (node.getType() === TableCellNode.getType()) {
      const cell = node as TableCellNode;
      if (hasAttr('colSpan')) {
        cell.setColSpan(typeof attrs.colSpan === 'number' ? attrs.colSpan : 1);
      }
      if (hasAttr('rowSpan')) {
        cell.setRowSpan(typeof attrs.rowSpan === 'number' ? attrs.rowSpan : 1);
      }
      if (hasAttr('width')) {
        cell.setWidth(typeof attrs.width === 'number' ? attrs.width : undefined);
      }
      if (hasAttr('backgroundColor')) {
        cell.setBackgroundColor(
          attrs.backgroundColor === null || typeof attrs.backgroundColor === 'string'
            ? (attrs.backgroundColor as string | null)
            : null,
        );
      }
      if (hasAttr('verticalAlign')) {
        cell.setVerticalAlign(
          typeof attrs.verticalAlign === 'string' ? attrs.verticalAlign : undefined,
        );
      }
      if (hasAttr('headerState')) {
        cell.setHeaderStyles(
          typeof attrs.headerState === 'number'
            ? (attrs.headerState as (typeof TableCellHeaderStates)[keyof typeof TableCellHeaderStates])
            : TableCellHeaderStates.NO_STATUS,
        );
      }
    }
    this.capabilities.get(node.getType())?.applyAttrs?.(node, attrs, previousAttrs);
  }

  private capturePoint(point: {
    getNode: () => LexicalNode;
    offset: number;
  }): LoroSelectionPoint | null {
    const node = point.getNode();
    const owner = getFlowOwner(node, (candidate) => this.isFlowOwner(candidate));
    if (!owner) return null;
    const ownerId = $getNodeId(owner);
    if (!ownerId) return null;
    const canonicalNode = this.canonical.findNodeById(ownerId);
    const flow = canonicalNode ? getAttachedText(canonicalNode, 'flow') : null;
    const offset = this.flowOffset(owner, node, point.offset);
    if (!flow || offset === null) return null;
    const cursor = flow.getCursor(offset, 0);
    if (!cursor) return null;
    return {
      containerId: flow.id,
      encodedCursor: cursor.encode(),
      flowNodeId: ownerId,
      side: 0,
    };
  }

  private flowOffset(
    owner: ElementNode,
    pointNode: LexicalNode,
    pointOffset: number,
  ): number | null {
    let offset = 0;
    let result: number | null = null;
    const visit = (node: LexicalNode): void => {
      if (result !== null) return;
      if ($isCursorNode(node)) return;
      if (node.is(pointNode)) {
        result = offset + pointOffset;
        return;
      }
      if ($isTextNode(node)) offset += node.getTextContentSize();
      else if ($isLineBreakNode(node)) offset += 1;
      else if ($isElementNode(node) && node.isInline()) node.getChildren().forEach(visit);
      else if ($isDecoratorNode(node) && node.isInline()) offset += 1;
    };
    owner.getChildren().forEach(visit);
    return result;
  }

  private resolveSelectionPoint(
    point: LoroSelectionPoint,
  ): { node: TextNode; offset: number } | null {
    const node = this.canonical.findNodeById(point.flowNodeId);
    const flow = node ? getAttachedText(node, 'flow') : null;
    const owner = this.lexicalByNodeId.get(point.flowNodeId);
    if (!flow || !$isElementNode(owner)) return null;
    const cursor = Cursor.decode(point.encodedCursor);
    const resolved = this.canonical.doc.getCursorPos(cursor);
    if (!resolved) return null;
    const target = resolved.offset;
    let offset = 0;
    let fallback: { node: TextNode; offset: number } | null = null;
    const visit = (child: LexicalNode): { node: TextNode; offset: number } | null => {
      if ($isCursorNode(child)) return null;
      if ($isTextNode(child)) {
        const length = child.getTextContentSize();
        if (target <= offset + length) return { node: child, offset: target - offset };
        fallback = { node: child, offset: length };
        offset += length;
        return null;
      }
      if ($isLineBreakNode(child)) {
        offset += 1;
        return null;
      }
      if ($isElementNode(child) && child.isInline()) {
        for (const nested of child.getChildren()) {
          const result = visit(nested);
          if (result) return result;
        }
      } else if ($isDecoratorNode(child) && child.isInline()) {
        offset += 1;
      }
      return null;
    };
    for (const child of owner.getChildren()) {
      const result = visit(child);
      if (result) return result;
    }
    return fallback;
  }

  private setReady(): void {
    if (this.phase === 'ready' || !this.hasAcceptedInitialSnapshot) return;
    this.allowInitializationSync = false;
    this.phase = 'ready';
    this.notifyReadiness();
  }

  private notifyReadiness(): void {
    for (const listener of this.readinessListeners) listener();
  }
}

const parentTreeIdOf = (node: LoroTreeNode): TreeID | undefined => node.parent()?.id;
