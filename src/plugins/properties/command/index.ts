import {
  $getRoot,
  $getSelection,
  type BaseSelection,
  COMMAND_PRIORITY_EDITOR,
  createCommand,
  HISTORY_PUSH_TAG,
  type LexicalCommand,
  type LexicalEditor,
} from 'lexical';

import type { IEditorKernel } from '@/types';

import { type AnnotationService, IAnnotationService } from '../service/annotation';
import type {
  AnnotationRecord,
  CreateAnnotationPayload,
  MarkAIGeneratedPayload,
  ResolveAnnotationPayload,
  SetNodePropertiesPayload,
  UpdateAnnotationPayload,
} from '../types';
import {
  $addAnnotationId,
  $applyPropertiesToNodeIds,
  $applyPropertiesToNodeKeys,
  $getNodesForSelectionOrIds,
  $getNodesForSelectionOrKeys,
  $markNodesAsAIGenerated,
  $removeAnnotationId,
} from '../utils';

export const SET_NODE_PROPERTIES_COMMAND = createCommand<SetNodePropertiesPayload>(
  'SET_NODE_PROPERTIES_COMMAND',
);
export const CREATE_ANNOTATION_COMMAND = createCommand<CreateAnnotationPayload>(
  'CREATE_ANNOTATION_COMMAND',
);
export const UPDATE_ANNOTATION_COMMAND = createCommand<UpdateAnnotationPayload>(
  'UPDATE_ANNOTATION_COMMAND',
);
export const REMOVE_ANNOTATION_COMMAND = createCommand<{ id: string }>('REMOVE_ANNOTATION_COMMAND');
export const RESOLVE_ANNOTATION_COMMAND = createCommand<ResolveAnnotationPayload>(
  'RESOLVE_ANNOTATION_COMMAND',
);
export const MARK_AI_GENERATED_COMMAND = createCommand<MarkAIGeneratedPayload>(
  'MARK_AI_GENERATED_COMMAND',
);
export interface OpenAnnotationComposerPayload extends Pick<
  CreateAnnotationPayload,
  'kind' | 'nodeIds' | 'nodeKeys' | 'payload' | 'quotedText'
> {
  rect?: DOMRect;
}

export const OPEN_ANNOTATION_COMPOSER_COMMAND = createCommand<OpenAnnotationComposerPayload>(
  'OPEN_ANNOTATION_COMPOSER_COMMAND',
);

export interface AnnotationCommandOptions {
  canEdit?: () => boolean;
}

export function registerPropertiesCommands(
  editor: LexicalEditor,
  kernel: IEditorKernel,
  options: AnnotationCommandOptions = {},
): () => void {
  const service = kernel.requireService(IAnnotationService);
  if (!service) return () => {};

  const canEdit = options.canEdit ?? (() => editor.isEditable());
  const unregisterSetProperties = editor.registerCommand(
    SET_NODE_PROPERTIES_COMMAND,
    (payload) => {
      if (!canEdit()) return true;
      editor.update(() => {
        const nodes = payload.nodeIds
          ? $getNodesForSelectionOrIds(payload.selection as BaseSelection | null, payload.nodeIds)
          : payload.nodeKeys
            ? $getNodesForSelectionOrKeys(
                payload.selection as BaseSelection | null,
                payload.nodeKeys,
              )
            : $getNodesForSelectionOrKeys(payload.selection as BaseSelection | null);
        if (payload.nodeIds) {
          $applyPropertiesToNodeIds(payload.nodeIds, payload.properties);
        } else if (payload.nodeKeys) {
          $applyPropertiesToNodeKeys(payload.nodeKeys, payload.properties);
        } else {
          for (const node of nodes) {
            // `$applyPropertiesToSelection` cannot be used here because a command may carry a
            // selection snapshot that is no longer the current selection.
            // The utility accepts updater functions and values alike.
            $applyPropertiesToNodeKeys([node.getKey()], payload.properties);
          }
        }
      });
      return true;
    },
    COMMAND_PRIORITY_EDITOR,
  );

  const unregisterCreate = editor.registerCommand(
    CREATE_ANNOTATION_COMMAND,
    (payload) => {
      if (!canEdit()) return true;
      editor.update(
        () => {
          const selection = (payload.selection as BaseSelection | null) ?? $getSelection();
          const selectedNodes = payload.nodeIds
            ? $getNodesForSelectionOrIds(selection, payload.nodeIds)
            : $getNodesForSelectionOrKeys(selection, payload.nodeKeys);
          if (selectedNodes.length === 0) return;

          const id = payload.id ?? createAnnotationId();
          const nodeKeys = selectedNodes.map((node) => node.getKey());
          for (const node of selectedNodes) $addAnnotationId(node, id);

          const quotedText = payload.quotedText ?? selection?.getTextContent() ?? '';
          service.create({
            author: payload.author,
            id,
            kind: payload.kind ?? 'comment',
            nodeKeys,
            payload: payload.payload ?? null,
            quotedText,
            status: 'active',
          });
        },
        // A comment is a distinct user action. Keep its metadata changes out of
        // the preceding typing history entry so one Undo removes only the
        // annotation anchors (and one Redo restores them).
        { tag: HISTORY_PUSH_TAG },
      );
      return true;
    },
    COMMAND_PRIORITY_EDITOR,
  );

  const unregisterUpdate = editor.registerCommand(
    UPDATE_ANNOTATION_COMMAND,
    (payload) => {
      if (!canEdit()) return true;
      service.update(payload.id, payload.patch);
      return true;
    },
    COMMAND_PRIORITY_EDITOR,
  );

  const unregisterRemove = editor.registerCommand(
    REMOVE_ANNOTATION_COMMAND,
    ({ id }) => {
      if (!canEdit()) return true;
      editor.update(
        () => {
          walkRoot((node) => $removeAnnotationId(node, id));
        },
        // Removing a comment is also a standalone user action. Its anchor
        // changes must not merge with nearby typing or formatting history.
        { tag: HISTORY_PUSH_TAG },
      );
      service.remove(id);
      return true;
    },
    COMMAND_PRIORITY_EDITOR,
  );

  const unregisterResolve = editor.registerCommand(
    RESOLVE_ANNOTATION_COMMAND,
    ({ id, status = 'resolved' }) => {
      if (!canEdit()) return true;
      service.resolve(id, status);
      return true;
    },
    COMMAND_PRIORITY_EDITOR,
  );

  const unregisterAI = editor.registerCommand(
    MARK_AI_GENERATED_COMMAND,
    (payload) => {
      if (!canEdit()) return true;
      editor.update(() => {
        const nodes = payload.nodeIds
          ? $getNodesForSelectionOrIds(
              payload.selection as BaseSelection | null,
              payload.nodeIds,
            )
          : $getNodesForSelectionOrKeys(
              payload.selection as BaseSelection | null,
              payload.nodeKeys,
            );
          $markNodesAsAIGenerated(nodes, {
            createdAt: payload.createdAt,
            generationId: payload.generationId,
            model: payload.model,
            sessionId: payload.provenanceSessionId,
            provider: payload.provider,
            requestId: payload.requestId,
            turnIndex: payload.turnIndex,
          });
      });
      return true;
    },
    COMMAND_PRIORITY_EDITOR,
  );

  return () => {
    unregisterSetProperties();
    unregisterCreate();
    unregisterUpdate();
    unregisterRemove();
    unregisterResolve();
    unregisterAI();
  };
}

export function createAnnotationId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `annotation-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

function walkRoot(callback: (node: import('lexical').LexicalNode) => void): void {
  const root = $getRoot();
  const walk = (node: import('lexical').LexicalNode) => {
    callback(node);
    if ('getChildren' in node && typeof node.getChildren === 'function') {
      for (const child of node.getChildren()) walk(child);
    }
  };
  walk(root);
}

export type AnnotationCommands = {
  [
    K in 'create' | 'update' | 'remove' | 'resolve' | 'markAI' | 'openComposer' | 'setProperties'
  ]: LexicalCommand<any>;
};

export const annotationCommands: AnnotationCommands = {
  create: CREATE_ANNOTATION_COMMAND,
  markAI: MARK_AI_GENERATED_COMMAND,
  openComposer: OPEN_ANNOTATION_COMPOSER_COMMAND,
  remove: REMOVE_ANNOTATION_COMMAND,
  resolve: RESOLVE_ANNOTATION_COMMAND,
  setProperties: SET_NODE_PROPERTIES_COMMAND,
  update: UPDATE_ANNOTATION_COMMAND,
};

export type { AnnotationRecord, AnnotationService };
