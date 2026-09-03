import { ListItemNode, ListNode } from '@lexical/list';
import { HeadingNode, QuoteNode } from '@lexical/rich-text';
import { TableCellNode, TableNode, TableRowNode } from '@lexical/table';
import type { Klass, LexicalEditor, LexicalNode } from 'lexical';
import {
  $getRoot,
  COLLABORATION_TAG,
  COMMAND_PRIORITY_CRITICAL,
  HISTORIC_TAG,
  HISTORY_MERGE_TAG,
  ParagraphNode,
  SELECTION_INSERT_CLIPBOARD_NODES_COMMAND,
} from 'lexical';

import { KernelPlugin } from '@/editor-kernel/plugin';
import { ArtifactNode } from '@/plugins/artifact/node/ArtifactNode';
import { CollapsibleNode } from '@/plugins/collapsible/node/CollapsibleNode';
import { IYjsService, type YjsPluginState } from '@/plugins/yjs/service';
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
import { $getNodeProperties, propertiesState } from '../state';
import { registerStreamingGenerationRegionGuard } from '../streaming-guard';
import {
  $ensureNodeId,
  $ensureNodeIdsInTree,
  $getNodeId,
  $isNodeIdentityTarget,
  $prepareCopiedNode,
} from '../utils';
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
  private reconcileScheduled = false;
  private nodeIdMigrationScheduled = false;
  private destroyed = false;
  private readonly seenAnchoredIds = new Set<string>();

  constructor(
    protected kernel: IEditorKernel,
    public config: PropertiesPluginOptions = {},
  ) {
    super();
    this.service.setStorageMode(config.annotationStorageMode ?? config.storageMode ?? 'embedded');
    kernel.registerServiceHotReload(IAnnotationService, this.service);
    // Keep the state config referenced by the plugin so consumers can import it from a single
    // public entrypoint. `$setState` also registers it lazily for custom node classes.
    void propertiesState;
  }

  onInit(editor: LexicalEditor): void {
    this.registerNodeIdentityTransforms(editor);

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

    const yjsService = this.kernel.requireService(IYjsService);
    if (yjsService) {
      this.register(
        yjsService.subscribe((state) => {
          if (state?.doc) {
            this.service.attachYMap(
              state.doc.getMap('lobe:annotations') as unknown as AnnotationMap,
            );
          }
          // Yjs may attach after the editor has already hydrated a legacy
          // document. Re-run the migration once its shared node map exists;
          // the migration then prefers the shared item identity as its seed.
          if (state) {
            queueMicrotask(() => this.migrateNodeIds(editor));
          }
        }),
      );
    }

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
    this.migrateNodeIds(editor);
  }

  onDocumentChange(): void {
    const editor = this.kernel.getLexicalEditor();
    if (editor) this.migrateNodeIds(editor);
  }

  override destroy(): void {
    this.destroyed = true;
    super.destroy();
  }

  /** Register transforms for the block classes shipped by this package. */
  private registerNodeIdentityTransforms(editor: LexicalEditor): void {
    const classes: Array<Klass<LexicalNode>> = [
      ParagraphNode,
      HeadingNode,
      QuoteNode,
      ListNode,
      ListItemNode,
      TableNode,
      TableRowNode,
      TableCellNode,
      ArtifactNode,
      CollapsibleNode,
    ];

    for (const nodeClass of classes) {
      if (!editor.hasNode(nodeClass)) continue;
      this.register(
        editor.registerNodeTransform(nodeClass, (node) => {
          // A collaborative binding owns the stable identity seed. Avoid
          // assigning a local value before the binding is ready, otherwise
          // simultaneous clients could preserve different legacy IDs.
          if (this.kernel.requireService(IYjsService)?.getState()) return;
          $ensureNodeId(node);
        }),
      );
    }
  }

  /** Run an idempotent legacy migration in its own syncable history group. */
  private migrateNodeIds(editor: LexicalEditor): void {
    if (this.destroyed) return;
    const yjsState = this.kernel.requireService(IYjsService)?.getState();
    // Wait for the collaboration plugin to publish its binding. The first
    // migration must not race that setup and choose a client-local identity.
    if (this.kernel.requireService(IYjsService) && !yjsState) return;
    if (!this.hasNodeIdentityConflicts(editor)) return;

    editor.update(
      () => {
        $ensureNodeIdsInTree($getRoot(), {
          stableIdentity: yjsState ? (node) => getYjsNodeIdentity(yjsState, node) : undefined,
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

  private hasNodeIdentityConflicts(editor: LexicalEditor): boolean {
    let hasConflict = false;
    const seen = new Set<string>();
    editor.getEditorState().read(() => {
      const visit = (node: import('lexical').LexicalNode): void => {
        if (!$isNodeIdentityTarget(node)) {
          if ('getChildren' in node && typeof node.getChildren === 'function') {
            node.getChildren().forEach(visit);
          }
          return;
        }
        const nodeId = $getNodeId(node);
        if (!nodeId || seen.has(nodeId)) hasConflict = true;
        if (nodeId) seen.add(nodeId);
        if ('getChildren' in node && typeof node.getChildren === 'function') {
          node.getChildren().forEach(visit);
        }
      };
      visit($getRoot());
    });
    return hasConflict;
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

function getYjsNodeIdentity(
  state: YjsPluginState,
  node: import('lexical').LexicalNode,
): string | undefined {
  const collabNode = state.binding.collabNodeMap.get(node.getKey());
  if (!collabNode) return undefined;

  const item = (
    collabNode.getSharedType() as unknown as {
      _item?: { id?: { client?: number; clock?: number } } | null;
    }
  )._item;
  if (!item?.id || !Number.isSafeInteger(item.id.client) || !Number.isSafeInteger(item.id.clock)) {
    return undefined;
  }
  return `${item.id.client}:${item.id.clock}`;
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
