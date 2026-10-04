import type { LexicalEditor } from 'lexical';
import {
  $getRoot,
  COLLABORATION_TAG,
  COMMAND_PRIORITY_CRITICAL,
  HISTORIC_TAG,
  HISTORY_MERGE_TAG,
  SELECTION_INSERT_CLIPBOARD_NODES_COMMAND,
} from 'lexical';

import { KernelPlugin } from '@/editor-kernel/plugin';
import { editorStateNeedsNodeIdNormalization } from '@/plugins/common/node/node-id';
import type { IEditorKernel, IEditorPlugin, IEditorPluginConstructor } from '@/types';

import { registerPropertiesCommands } from '../command';
import {
  type AnnotationMap,
  AnnotationServiceImpl,
  type AnnotationStorageMode,
  IAnnotationService,
} from '../service/annotation';
import {
  readAnnotationSnapshot,
  registerJSONDataSourceMetadataExtension,
} from '../service/json-metadata';
import {
  getOrCreatePropertiesService,
  type IPropertiesService,
  registerPropertiesNodeIdentityNormalization,
} from '../service/properties';
import { $getNodeProperties, propertiesState } from '../state';
import { registerStreamingGenerationRegionGuard } from '../streaming-guard';
import { $ensureNodeIdsInTree, $prepareCopiedNode } from '../utils';
import { syncNodePropertiesToDOM } from '../utils-dom';

export interface PropertiesPluginOptions {
  /**
   * Keep annotation bodies in the editor document (default) or expose them
   * through the service mutation API for host-owned persistence.
   */
  annotationStorageMode?: AnnotationStorageMode;
  enabled?: boolean;
  readOnly?: boolean;
  /** Alias kept for integrations that configure plugins generically. */
  storageMode?: AnnotationStorageMode;
}

/**
 * Installs the document annotation repository and command handlers.
 * NodeState itself is usable without this plugin; registering the plugin adds persistence,
 * collaboration, orphan tracking, and the DOM metadata bridge.
 */
export const PropertiesPlugin: IEditorPluginConstructor<PropertiesPluginOptions> = class
  extends KernelPlugin
  implements IEditorPlugin<PropertiesPluginOptions>
{
  static pluginName = 'PropertiesPlugin';

  readonly service = new AnnotationServiceImpl();
  readonly propertiesService: IPropertiesService;
  private reconcileScheduled = false;
  private nodeIdMigrationScheduled = false;
  private destroyed = false;
  private collaborationCleanup: (() => void) | null = null;
  private readonly seenAnchoredIds = new Set<string>();

  constructor(
    protected kernel: IEditorKernel,
    public config: PropertiesPluginOptions = {},
  ) {
    super();
    this.propertiesService = getOrCreatePropertiesService(kernel);
    this.service.setStorageMode(config.annotationStorageMode ?? config.storageMode ?? 'embedded');
    kernel.registerServiceHotReload(IAnnotationService, this.service);
    // Keep the state config referenced by the plugin so consumers can import it from a single
    // public entrypoint. `$setState` also registers it lazily for custom node classes.
    void propertiesState;
  }

  onConfigChange(config: PropertiesPluginOptions): void {
    // Page can become editable after collaboration authorization completes.
    // Command guards must use the current permissions, not hydration-time
    // readOnly; the reverse transition must also revoke writes immediately.
    this.config = config;
    const storageMode = config.annotationStorageMode ?? config.storageMode;
    if (storageMode) this.service.setStorageMode(storageMode);
  }

  onInit(editor: LexicalEditor): void {
    this.register(registerPropertiesNodeIdentityNormalization(editor, this.propertiesService));

    const scheduleReconcile = () => {
      if (this.reconcileScheduled) return;
      this.reconcileScheduled = true;
      queueMicrotask(() => {
        this.reconcileScheduled = false;
        this.reconcileAnchors(editor.getEditorState());
        syncNodePropertiesToDOM(editor);
      });
    };

    this.register(
      this.service.subscribeMutations((mutation) => {
        // Imports and legacy migrations can arrive after the editor tree has
        // already hydrated. Reconcile on the next microtask so the current
        // EditorState is visible, while local reconciliation updates do not
        // recursively schedule another pass.
        if (mutation.source === 'import' || mutation.source === 'migration') {
          scheduleReconcile();
        }
      }),
    );

    // Collaboration is an optional provider. The provider owns transport
    // details (including Y.Map hookup and shared-item identity), while this
    // plugin only reacts to its neutral readiness/identity contract.
    this.register(
      this.propertiesService.subscribeCollaborationProvider((provider) => {
        this.collaborationCleanup?.();
        this.collaborationCleanup = null;

        if (provider) {
          const detachAnnotationStorage = provider.attachAnnotationStorage({
            attachMap: (map: AnnotationMap, owner?: object) => this.service.attachYMap(map, owner),
            detachMap: (map?: AnnotationMap, owner?: object) => this.service.detachYMap(map, owner),
          });
          const unsubscribeProvider = provider.subscribe(() => {
            this.scheduleNodeIdMigration(editor);
          });
          this.collaborationCleanup = () => {
            unsubscribeProvider();
            detachAnnotationStorage();
          };
        }
        // Removing an initializing provider restores standalone behavior. A
        // pending migration must be retried even when no replacement provider
        // is installed.
        this.scheduleNodeIdMigration(editor);
      }),
    );

    this.register(
      registerPropertiesCommands(editor, this.kernel, {
        canEdit: () => editor.isEditable() && this.config.readOnly !== true,
      }),
    );

    // Active Agent output is a temporary protected region. Keep the guard in
    // the properties plugin so every browser/headless editor that understands
    // NodeState enforces the same selection-scoped rule, including peers that
    // did not create the stream themselves.
    this.register(
      registerStreamingGenerationRegionGuard(editor, {
        enabled: () => editor.isEditable() && this.config.readOnly !== true,
      }),
    );

    this.register(
      editor.registerCommand(
        SELECTION_INSERT_CLIPBOARD_NODES_COMMAND,
        (payload: { nodes?: import('lexical').LexicalNode[] }) => {
          for (const node of payload.nodes ?? []) $prepareCopiedNode(node);
          // Let Lexical's normal insertion command continue after metadata has been sanitized.
          return false;
        },
        COMMAND_PRIORITY_CRITICAL,
      ),
    );

    this.register(
      registerJSONDataSourceMetadataExtension(editor, {
        onRead: (root) => {
          const records = readAnnotationSnapshot(root);
          this.service.importSnapshot(records);
        },
        onWrite: (root) => {
          if (this.service.getStorageMode() === 'external') {
            stripAnnotationSnapshot(root);
            return;
          }
          const annotations = this.service.getAll();
          const currentState = isRecord(root.$) ? root.$ : {};
          const currentProperties = isRecord(currentState.properties)
            ? currentState.properties
            : {};
          const currentDocument = isRecord(currentProperties.document)
            ? currentProperties.document
            : {};
          if (annotations.length === 0) {
            if (!('annotations' in currentDocument)) return;
            const { annotations: _removed, ...documentWithoutAnnotations } = currentDocument;
            const nextProperties = { ...currentProperties };
            if (Object.keys(documentWithoutAnnotations).length > 0) {
              nextProperties.document = documentWithoutAnnotations;
            } else {
              delete nextProperties.document;
            }
            const nextState = { ...currentState };
            if (Object.keys(nextProperties).length > 0) {
              nextState.properties = nextProperties;
            } else {
              delete nextState.properties;
            }
            if (Object.keys(nextState).length > 0) root.$ = nextState;
            else delete root.$;
            return;
          }
          root.$ = {
            ...currentState,
            properties: {
              ...currentProperties,
              document: {
                ...currentDocument,
                annotations,
              },
            },
          };
        },
      }),
    );

    this.register(
      editor.registerUpdateListener(
        ({ dirtyElements, dirtyLeaves, editorState, normalizedNodes, prevEditorState, tags }) => {
          const hasNodeChanges =
            dirtyElements.size > 0 || dirtyLeaves.size > 0 || normalizedNodes.size > 0;
          const shouldReconcile =
            hasNodeChanges || tags.has(COLLABORATION_TAG) || tags.has(HISTORIC_TAG);

          // The scan is read-only and makes orphan transitions deterministic after deletes, undo,
          // and remote Yjs updates. Selection-only transactions do not need a full tree scan.
          if (shouldReconcile) {
            this.reconcileAnchors(editorState, prevEditorState);
            syncNodePropertiesToDOM(editor);
          }

          // Built-in classes are covered synchronously by node transforms. A
          // deferred scan handles custom block classes and legacy nodes
          // arriving from a remote Yjs update without nesting an editor update
          // inside Lexical's update listener.
          if (shouldReconcile) this.scheduleNodeIdMigration(editor);
        },
      ),
    );

    // A plugin can be registered after the editor has already hydrated its
    // initial content. Establish the first anchor baseline immediately.
    this.reconcileAnchors(editor.getEditorState());
    syncNodePropertiesToDOM(editor);
    // Run after every plugin's onInit so a Yjs or Loro identity provider can
    // publish its initial readiness barrier before the root normalizer runs.
    this.scheduleNodeIdMigration(editor);
  }

  onDocumentChange(): void {
    const editor = this.kernel.getLexicalEditor();
    if (editor) this.migrateNodeIds(editor);
  }

  override destroy(): void {
    this.destroyed = true;
    this.collaborationCleanup?.();
    this.collaborationCleanup = null;
    super.destroy();
  }

  /** Run an idempotent legacy migration in its own syncable history group. */
  private migrateNodeIds(editor: LexicalEditor): void {
    if (this.destroyed) return;
    const provider = this.propertiesService.getCollaborationProvider();
    // Wait for the collaboration plugin to publish its binding. The first
    // migration must not race that setup and choose a client-local identity.
    if (provider && provider.getReadiness() !== 'ready') return;
    if (!editorStateNeedsNodeIdNormalization(editor.getEditorState(), editor)) return;

    editor.update(
      () => {
        $ensureNodeIdsInTree($getRoot(), {
          stableIdentity: provider ? (node) => provider.getNodeIdentity(node) : undefined,
        });
      },
      // This keeps migration out of adjacent typing history while allowing
      // the Yjs sync listener to publish the generated properties.
      { tag: HISTORY_MERGE_TAG },
    );
  }

  private scheduleNodeIdMigration(editor: LexicalEditor): void {
    if (this.nodeIdMigrationScheduled) return;
    this.nodeIdMigrationScheduled = true;
    queueMicrotask(() => {
      this.nodeIdMigrationScheduled = false;
      if (!this.destroyed) this.migrateNodeIds(editor);
    });
  }

  private reconcileAnchors(
    editorState: import('lexical').EditorState,
    previousEditorState?: import('lexical').EditorState,
  ): void {
    const anchorMap = new Map<string, string[]>();
    const deletedNodeKeys = previousEditorState
      ? getDeletedNodeKeys(previousEditorState, editorState)
      : new Set<string>();
    const deletedAnnotationIds = previousEditorState
      ? getDeletedAnnotationIds(previousEditorState, deletedNodeKeys)
      : new Set<string>();
    editorState.read(() => {
      editorState._nodeMap.forEach((node) => {
        const ids = $getNodeProperties(node).annotationIds ?? [];
        for (const id of ids) {
          this.seenAnchoredIds.add(id);
          const anchors = anchorMap.get(id) ?? [];
          anchors.push(node.getKey());
          anchorMap.set(id, anchors);
        }
      });
    });

    for (const record of this.service.getAll()) {
      const nodeKeys = anchorMap.get(record.id) ?? [];
      const hasDeletedAnchor = deletedAnnotationIds.has(record.id);
      const canMarkOrphaned = this.seenAnchoredIds.has(record.id) || Boolean(hasDeletedAnchor);
      if (nodeKeys.length === 0 && record.status === 'active' && canMarkOrphaned) {
        this.service.update(record.id, { nodeKeys, status: 'orphaned' });
      } else if (nodeKeys.length > 0 && record.status === 'orphaned') {
        this.service.update(record.id, { nodeKeys, status: 'active' });
      } else if (nodeKeys.length > 0 && !sameKeys(record.nodeKeys, nodeKeys)) {
        this.service.update(record.id, { nodeKeys });
      }
    }
  }
};

function getDeletedNodeKeys(
  previousEditorState: import('lexical').EditorState,
  editorState: import('lexical').EditorState,
): Set<string> {
  const currentNodeKeys = new Set<string>();
  editorState.read(() => {
    editorState._nodeMap.forEach((_node, key) => currentNodeKeys.add(key));
  });

  const deletedNodeKeys = new Set<string>();
  previousEditorState.read(() => {
    previousEditorState._nodeMap.forEach((_node, key) => {
      if (!currentNodeKeys.has(key)) deletedNodeKeys.add(key);
    });
  });
  return deletedNodeKeys;
}

function getDeletedAnnotationIds(
  previousEditorState: import('lexical').EditorState,
  deletedNodeKeys: Set<string>,
): Set<string> {
  const deletedAnnotationIds = new Set<string>();
  if (deletedNodeKeys.size === 0) return deletedAnnotationIds;

  previousEditorState.read(() => {
    previousEditorState._nodeMap.forEach((node, key) => {
      if (!deletedNodeKeys.has(key)) return;
      for (const id of $getNodeProperties(node).annotationIds ?? []) {
        deletedAnnotationIds.add(id);
      }
    });
  });
  return deletedAnnotationIds;
}

function sameKeys(left: string[] | undefined, right: string[]): boolean {
  if (!left || left.length !== right.length) return false;
  return left.every((key, index) => key === right[index]);
}

function isRecord(value: unknown): value is Record<string, any> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Remove legacy annotation bodies from an external-mode JSON export. */
function stripAnnotationSnapshot(root: Record<string, unknown>): void {
  const currentState = isRecord(root.$) ? root.$ : root;
  const currentProperties = isRecord(currentState.properties) ? currentState.properties : null;
  const metadata = currentProperties ?? currentState;
  const currentDocument = isRecord(metadata.document) ? metadata.document : null;
  if (!currentDocument || !('annotations' in currentDocument)) return;

  const { annotations: _removed, ...documentWithoutAnnotations } = currentDocument;
  if (Object.keys(documentWithoutAnnotations).length > 0) {
    metadata.document = documentWithoutAnnotations;
  } else {
    delete metadata.document;
  }
  if (currentProperties && Object.keys(currentProperties).length === 0) {
    delete currentState.properties;
  }
  if (!currentProperties && Object.keys(currentState).length === 0) {
    if (currentState === root) return;
    delete root.$;
  }

  if (currentState !== root) {
    if (Object.keys(currentState).length > 0) root.$ = currentState;
    else delete root.$;
  }
}
