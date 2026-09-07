import {
  type Binding,
  CONNECTED_COMMAND,
  createBinding,
  type Provider,
  syncLexicalUpdateToYjs,
  syncYjsChangesToLexical,
  TOGGLE_CONNECT_COMMAND,
} from '@lexical/yjs';
import {
  $getRoot,
  COLLABORATION_TAG,
  COMMAND_PRIORITY_CRITICAL,
  HISTORIC_TAG,
  type LexicalEditor,
  SKIP_COLLAB_TAG,
} from 'lexical';
import type { Doc, Text as YText, YEvent } from 'yjs';
import { UndoManager } from 'yjs';

import { KernelPlugin } from '@/editor-kernel/plugin';
import {
  getOrCreatePropertiesService,
  type IPropertiesService,
} from '@/plugins/properties/service/properties';
import type { IEditorKernel, IEditorPlugin, IEditorPluginConstructor } from '@/types';

import { IYjsService, YjsService } from '../service';
import { YjsPropertiesProvider } from './properties-provider';
import type { YjsPluginOptions } from './types';
import { getAwarenessUsers } from './utils/awareness';
import { createRemoteCaretViewportStabilizer } from './utils/caret-viewport-anchor';
import { clearEditorSkipCollab, initializeEditor } from './utils/editor-state';
import { createYjsHumanOrigin, registerYjsHistory, type YjsHistoryOrigin } from './utils/history';
import {
  $syncAnnotationNodePropertiesFromYjs,
  ensureYjsNodePropertiesFromEditorState,
} from './utils/node-properties';
import {
  hydrateLexicalFromYjsState,
  syncCurrentEditorStateToYjs,
  transactWithYjsOrigin,
  YJS_SYSTEM_ORIGIN,
} from './utils/sync';

export type { YjsInitialEditorState, YjsPluginOptions, YjsProviderFactory } from './types';

type OnYjsTreeChanges = (events: Array<YEvent<YText>>, transaction: YjsTransaction) => void;

type YjsTransaction = {
  origin: unknown;
};

interface ConnectionState {
  connection: Promise<void> | void;
  hasConnected: boolean;
}

interface SyncState {
  documentHasChanged: boolean;
  initialSyncApplied: boolean;
  providerHasSynced: boolean;
}

type YjsStateEventTarget = {
  _item?: { parentSub?: string } | null;
  keysChanged?: Set<string>;
  parent?: unknown;
};

type YjsCollabType = {
  _collabNode?: unknown;
  forEach?: (callback: (value: unknown) => void) => void;
  toDelta?: () => ReadonlyArray<{ insert?: unknown }>;
};

/**
 * @lexical/yjs caches the CollabNode on every Y.XmlText/XmlElement/Map. The
 * public Binding API only exposes collabNodeMap, so clearing that map alone
 * leaves the old CollabElementNode._children attached to shared types. A
 * subsequent full delta replay then appends the same text/decorators again.
 */
function clearYjsCollabTypeCaches(
  value: unknown,
  visited: Set<unknown>,
  rootSharedType: unknown,
): void {
  if (!value || typeof value !== 'object' || visited.has(value)) return;
  visited.add(value);

  const sharedType = value as YjsCollabType;
  if (value !== rootSharedType) delete sharedType._collabNode;

  sharedType.toDelta?.().forEach((delta) => {
    if (delta.insert && typeof delta.insert === 'object') {
      clearYjsCollabTypeCaches(delta.insert, visited, rootSharedType);
    }
  });
  sharedType.forEach?.((child) => clearYjsCollabTypeCaches(child, visited, rootSharedType));
}

function disposeCollabNodeCache(binding: Binding): void {
  const collabRoot = binding.root as Binding['root'] & { _children: unknown[] };
  const rootSharedType = collabRoot._xmlText as unknown;

  // Destroy the old CollabNode tree before clearing the map, then remove the
  // private shared-type caches that destroy() intentionally leaves intact.
  collabRoot.destroy(binding);
  binding.collabNodeMap.clear();
  clearYjsCollabTypeCaches(rootSharedType, new Set(), rootSharedType);
  collabRoot._children.length = 0;
  (rootSharedType as YjsCollabType)._collabNode = collabRoot;
}

/**
 * Make the shared room authoritative when the host hydrated JSON before the
 * provider's first snapshot. Replaying that snapshot into a populated local
 * root can append a second copy of decorator/block nodes because the Yjs
 * mapping does not belong to the host's pre-hydrated Lexical nodes.
 */
function replaceLexicalStateFromYjs(editor: LexicalEditor, binding: Binding): void {
  disposeCollabNodeCache(binding);
  clearEditorSkipCollab(editor);
  hydrateLexicalFromYjsState(binding, { discrete: true });
}

function getAnnotationStateTarget(event: YEvent<YText>): unknown {
  const target = event.target as unknown as YjsStateEventTarget;
  const keysChanged = (event as unknown as { keysChanged?: Set<string> }).keysChanged;
  if (keysChanged?.has('__state')) return target;
  if (target._item?.parentSub === '__state') return target.parent;
  return undefined;
}

function collectAnnotationStateNodeKeys(
  binding: Binding,
  events: ReadonlyArray<YEvent<YText>>,
): Set<string> {
  const targets = new Set(events.map(getAnnotationStateTarget).filter(Boolean));
  if (targets.size === 0) return new Set();

  const nodeKeys = new Set<string>();
  binding.collabNodeMap.forEach((collabNode, nodeKey) => {
    if (targets.has(collabNode.getSharedType())) nodeKeys.add(nodeKey);
  });
  return nodeKeys;
}

export const YjsPlugin: IEditorPluginConstructor<YjsPluginOptions> = class
  extends KernelPlugin
  implements IEditorPlugin<YjsPluginOptions>
{
  static pluginName = 'YjsPlugin';

  private bootstrapCurrentEditorState: (() => void) | null = null;
  private docMap = new Map<string, Doc>();
  private hasInitialized = false;
  private isReloadingDoc = false;
  private markDocumentChanged: (() => void) | null = null;
  private propertiesProviderDisposer: (() => void) | null = null;
  private readonly propertiesService: IPropertiesService;
  private service = new YjsService();

  constructor(
    protected kernel: IEditorKernel,
    public config?: YjsPluginOptions,
  ) {
    super();
    this.propertiesService = getOrCreatePropertiesService(kernel);
    kernel.registerServiceHotReload(IYjsService, this.service);
    this.registerPropertiesProvider();
  }

  destroy(): void {
    super.destroy();
    // KernelPlugin preserves cleanup registrations for backwards-compatible
    // repeated destroy calls. Yjs reconfiguration is different: its old
    // provider/binding resources must not be torn down a second time after
    // the replacement has been initialized.
    this.clears = [];
    this.bootstrapCurrentEditorState = null;
    this.hasInitialized = false;
    this.isReloadingDoc = false;
    this.markDocumentChanged = null;
    this.service.setState(null);
  }

  private registerPropertiesProvider(): void {
    if (this.propertiesProviderDisposer) return;

    const provider = new YjsPropertiesProvider(this.service);
    const disposer = this.propertiesService.registerCollaborationProvider(provider);
    this.propertiesProviderDisposer = disposer;
    this.register(() => {
      disposer();
      if (this.propertiesProviderDisposer === disposer) {
        this.propertiesProviderDisposer = null;
      }
    });
  }

  /**
   * Rebuild the binding/provider when a React collaboration plugin receives a
   * refreshed ticket or a new room after the kernel has already initialized.
   * The Yjs document map is deliberately retained so a provider replacement
   * can resume from the existing CRDT state vector instead of bootstrapping a
   * second tree.
   */
  onConfigChange(config: YjsPluginOptions): void {
    if (this.config === config) return;
    this.config = config;

    const editor = this.kernel.getLexicalEditor();
    if (!this.hasInitialized || !editor) return;

    this.destroy();
    this.config = config;
    this.onInit(editor);
  }

  onDocumentChange(): void {
    this.markDocumentChanged?.();
  }

  private connectProvider(provider: Provider, connectionState: ConnectionState): void {
    // Start document-level sync after listeners are registered and the document is ready.
    if (connectionState.hasConnected) {
      return;
    }

    connectionState.hasConnected = true;
    connectionState.connection = provider.connect();
  }

  private registerAwareness(provider: Provider): void {
    this.service.setAwarenessUsers(getAwarenessUsers(provider));

    const updateAwarenessUsers = () => {
      this.service.setAwarenessUsers(getAwarenessUsers(provider));
    };

    provider.awareness.on('update', updateAwarenessUsers);

    this.register(() => {
      provider.awareness.off('update', updateAwarenessUsers);
      this.service.setAwarenessUsers([]);
    });
  }

  private registerEditorSync(
    editor: LexicalEditor,
    binding: Binding,
    provider: Provider,
    shouldBootstrap: boolean,
    syncState: SyncState,
    humanOrigin: YjsHistoryOrigin,
  ): void {
    this.register(
      editor.registerUpdateListener(
        ({ dirtyElements, dirtyLeaves, editorState, normalizedNodes, prevEditorState, tags }) => {
          if (tags.has(SKIP_COLLAB_TAG) || tags.has(COLLABORATION_TAG)) {
            return;
          }

          // Ignore local editor updates until the provider has reported its initial sync state.
          // Before the first room snapshot, local JSON hydration must not be
          // published. After a completed sync, however, edits made during a
          // reconnect gap are genuine pending local edits and must be queued
          // into the existing Y.Doc for the next authenticated connection.
          if (!syncState.providerHasSynced && !syncState.initialSyncApplied) {
            return;
          }

          ensureYjsNodePropertiesFromEditorState(binding, editorState);

          if (
            shouldBootstrap &&
            syncState.providerHasSynced &&
            binding.root.isEmpty() &&
            binding.root._xmlText._length === 0
          ) {
            const isEditorEmpty = editorState.read(() => $getRoot().isEmpty());

            if (!isEditorEmpty) {
              syncCurrentEditorStateToYjs(binding, provider);
              return;
            }
          }

          transactWithYjsOrigin(binding, humanOrigin, () => {
            syncLexicalUpdateToYjs(
              binding,
              provider,
              prevEditorState,
              editorState,
              dirtyElements,
              dirtyLeaves,
              normalizedNodes,
              tags,
            );
          });
        },
      ),
    );
  }

  private registerProviderEvents(
    editor: LexicalEditor,
    binding: Binding,
    provider: Provider,
    id: string,
    syncState: SyncState,
  ): void {
    const onProviderDocReload = (doc: Doc) => {
      clearEditorSkipCollab(editor);
      this.docMap.set(id, doc);
      this.isReloadingDoc = true;
      syncState.initialSyncApplied = false;
      this.service.setReady(false);
      this.service.setState({
        binding,
        doc,
        docMap: this.docMap,
        id,
        provider,
      });
    };

    const onStatus = ({ status }: { status: string }) => {
      editor.dispatchCommand(CONNECTED_COMMAND, status === 'connected');
    };

    const onSync = (isSynced: boolean) => {
      if (!isSynced) {
        syncState.providerHasSynced = false;
        return;
      }

      syncState.providerHasSynced = true;

      if (this.isReloadingDoc) {
        this.isReloadingDoc = false;
        this.service.setReady(true);
        return;
      }

      if (!syncState.initialSyncApplied) {
        syncState.initialSyncApplied = true;
        if (binding.root._xmlText._length > 0) {
          replaceLexicalStateFromYjs(editor, binding);
          this.service.setReady(true);
          return;
        }
      }

      if (binding.root.isEmpty() && binding.root._xmlText._length > 0) {
        replaceLexicalStateFromYjs(editor, binding);
        this.service.setReady(true);
        return;
      }

      this.bootstrapCurrentEditorState?.();
      this.service.setReady(true);
    };

    provider.on('reload', onProviderDocReload);
    provider.on('status', onStatus);
    provider.on('sync', onSync);

    this.register(() => {
      provider.off('reload', onProviderDocReload);
      provider.off('status', onStatus);
      provider.off('sync', onSync);
      this.bootstrapCurrentEditorState = null;
      this.markDocumentChanged = null;
    });
  }

  private registerProviderToggleCommand(editor: LexicalEditor, provider: Provider): void {
    this.register(
      editor.registerCommand(
        TOGGLE_CONNECT_COMMAND,
        (shouldConnect) => {
          if (shouldConnect) {
            provider.connect();
          } else {
            provider.disconnect();
          }

          return true;
        },
        COMMAND_PRIORITY_CRITICAL,
      ),
    );
  }

  private registerProviderTeardown(
    binding: Binding,
    provider: Provider,
    connectionState: ConnectionState,
  ): void {
    this.register(() => {
      const disconnect = () => provider.disconnect();

      // Close immediately even when a provider's connect promise is still
      // pending. Waiting only on that promise leaks a stale socket during a
      // ticket/room reconfiguration.
      disconnect();
      if (connectionState.connection) {
        connectionState.connection.then(disconnect, disconnect);
      }

      binding.root.destroy(binding);
      this.service.setState(null);
    });
  }

  private registerYjsTreeSync(
    editor: LexicalEditor,
    binding: Binding,
    provider: Provider,
    syncState: SyncState,
    localOrigins: ReadonlySet<unknown>,
  ): void {
    const caretViewportStabilizer = createRemoteCaretViewportStabilizer(editor);
    this.register(caretViewportStabilizer.dispose);

    const onYjsTreeChanges: OnYjsTreeChanges = (events, transaction) => {
      if (transaction.origin === binding || localOrigins.has(transaction.origin)) {
        return;
      }

      // Do not project the provider's first snapshot into host-hydrated JSON
      // before the sync barrier. Once an initial snapshot has been applied,
      // updates received during a reconnect gap must use the existing mapping
      // incrementally; the sync barrier itself must not replay a full delta.
      if (!syncState.providerHasSynced && !syncState.initialSyncApplied) return;

      const isFromUndoManager = transaction.origin instanceof UndoManager;
      const annotationStateNodeKeys = collectAnnotationStateNodeKeys(binding, events);
      if (syncState.providerHasSynced) {
        if (isFromUndoManager) {
          caretViewportStabilizer.cancelPending();
        } else {
          caretViewportStabilizer.captureBeforeRemoteUpdate();
        }
      }

      try {
        syncYjsChangesToLexical(
          binding,
          provider,
          events,
          isFromUndoManager,
          (_binding, _provider) => {
            caretViewportStabilizer.scheduleAfterRemoteUpdate();
            if (annotationStateNodeKeys.size > 0) {
              // Yjs 0.42 can leave a deleted `__state` map reflected in Lexical's
              // previous NodeState. Reconcile only the annotation state after the
              // upstream tree sync; this preserves text, structure, and selection.
              editor.update(
                () => $syncAnnotationNodePropertiesFromYjs(binding, annotationStateNodeKeys),
                { tag: isFromUndoManager ? HISTORIC_TAG : COLLABORATION_TAG },
              );
            }
          },
        );
      } catch (error) {
        caretViewportStabilizer.cancelPending();
        throw error;
      }
    };

    binding.root.getSharedType().observeDeep(onYjsTreeChanges);

    this.register(() => {
      binding.root.getSharedType().unobserveDeep(onYjsTreeChanges);
    });
  }

  private setBootstrapCurrentEditorState(
    editor: LexicalEditor,
    binding: Binding,
    provider: Provider,
    initialEditorState: YjsPluginOptions['initialEditorState'],
    shouldBootstrap: boolean,
    syncState: SyncState,
  ): void {
    this.bootstrapCurrentEditorState = () => {
      // Bootstrap only after both sides are ready: provider sync and local document load.
      if (
        !shouldBootstrap ||
        !syncState.providerHasSynced ||
        (!syncState.documentHasChanged && !initialEditorState) ||
        !binding.root.isEmpty() ||
        binding.root._xmlText._length !== 0
      ) {
        return;
      }

      const isEditorEmpty = editor.getEditorState().read(() => $getRoot().isEmpty());

      if (isEditorEmpty && !initialEditorState) {
        return;
      }

      if (initialEditorState) {
        clearEditorSkipCollab(editor);
        initializeEditor(editor, initialEditorState, {
          discrete: true,
          skipIfNotEmpty: false,
          tag: undefined,
        });
      }

      syncCurrentEditorStateToYjs(binding, provider);
    };
  }

  private setServiceState(binding: Binding, id: string, provider: Provider, doc?: Doc): void {
    this.service.setState({
      binding,
      doc,
      docMap: this.docMap,
      id,
      provider,
    });
  }

  onInit(editor: LexicalEditor): void {
    const {
      excludedProperties,
      id,
      initialEditorState,
      providerFactory,
      shouldBootstrap = true,
      yjsDoc,
    } = this.config || {};

    if (!id || !providerFactory) {
      throw new Error('YjsPlugin requires both "id" and "providerFactory".');
    }

    if (this.hasInitialized) {
      return;
    }

    // A reconfigured plugin has already disposed its previous provider
    // registration in destroy(); restore the neutral bridge before binding.
    this.registerPropertiesProvider();

    this.hasInitialized = true;

    if (yjsDoc) {
      this.docMap.set(id, yjsDoc);
    }

    const provider = providerFactory(id, this.docMap);
    const connectionState: ConnectionState = {
      connection: undefined,
      hasConnected: false,
    };
    const syncState: SyncState = {
      documentHasChanged: false,
      initialSyncApplied: false,
      providerHasSynced: false,
    };
    const binding = createBinding(
      editor,
      provider,
      id,
      this.docMap.get(id),
      this.docMap,
      excludedProperties,
    );
    this.setServiceState(binding, id, provider, this.docMap.get(id));
    this.registerAwareness(provider);
    // The history bridge must be registered before the editor -> Yjs sync
    // listener. It closes Yjs capture on HISTORY_PUSH_TAG before the tagged
    // transaction is written, keeping standalone commands (for example
    // comment creation) separate from nearby typing.
    const humanOrigin = createYjsHumanOrigin();
    this.register(registerYjsHistory(editor, binding, { humanOrigin }));
    this.registerYjsTreeSync(
      editor,
      binding,
      provider,
      syncState,
      new Set([binding, humanOrigin, YJS_SYSTEM_ORIGIN]),
    );
    this.registerEditorSync(editor, binding, provider, shouldBootstrap, syncState, humanOrigin);
    this.setBootstrapCurrentEditorState(
      editor,
      binding,
      provider,
      initialEditorState,
      shouldBootstrap,
      syncState,
    );

    this.markDocumentChanged = () => {
      syncState.documentHasChanged = true;
      // setDocument has completed; it is now safe to start provider sync.
      this.connectProvider(provider, connectionState);
      this.bootstrapCurrentEditorState?.();
    };

    this.registerProviderEvents(editor, binding, provider, id, syncState);
    this.registerProviderToggleCommand(editor, provider);

    if (initialEditorState) {
      this.connectProvider(provider, connectionState);
    }

    this.registerProviderTeardown(binding, provider, connectionState);
  }
};
