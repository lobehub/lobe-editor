import type { LexicalEditor, LexicalNode } from 'lexical';
import { COMMAND_PRIORITY_EDITOR } from 'lexical';

import { $setNodeProperties } from '@/plugins/properties/state';
import { $findNodeById } from '@/plugins/properties/utils';
import type { IEditorKernel } from '@/types';

import { IBlockRewriteAdapterService } from '../service/rewrite-adapter';
import { APPLY_BLOCK_REWRITE_COMMAND, type ApplyBlockRewritePayload } from './symbols';

export type { ApplyBlockRewritePayload } from './symbols';
export { APPLY_BLOCK_REWRITE_COMMAND } from './symbols';

const applyNodeProvenance = (node: LexicalNode, metadata: ApplyBlockRewritePayload): void => {
  if (!metadata.provenanceSessionId && !metadata.generationId && !metadata.requestId) return;
  $setNodeProperties(node, (previous) => ({
    ...previous,
    provenance: {
      ...previous.provenance,
      ...(metadata.createdAt ? { createdAt: metadata.createdAt } : {}),
      ...(metadata.generationId ? { generationId: metadata.generationId } : {}),
      ...(metadata.model ? { model: metadata.model } : {}),
      ...(metadata.provenanceSessionId ? { sessionId: metadata.provenanceSessionId } : {}),
      ...(metadata.provider ? { provider: metadata.provider } : {}),
      ...(metadata.requestId ? { requestId: metadata.requestId } : {}),
      source: 'ai',
      ...(metadata.turnIndex === undefined ? {} : { turnIndex: metadata.turnIndex }),
    },
  }));
};

const resolveNode = (nodeId: string): LexicalNode | null => {
  return $findNodeById(nodeId);
};

const registeredEditors = new WeakSet<LexicalEditor>();

export const registerBlockRewriteCommand = (
  editor: LexicalEditor,
  kernel: IEditorKernel,
): (() => void) => {
  if (registeredEditors.has(editor)) return () => {};
  registeredEditors.add(editor);
  const unregister = editor.registerCommand(
    APPLY_BLOCK_REWRITE_COMMAND,
    (payload) => {
      if (
        !editor.isEditable() ||
        !payload ||
        typeof payload.nodeId !== 'string' ||
        !payload.adapterKey
      ) {
        return false;
      }

      const service = kernel.requireService(IBlockRewriteAdapterService);
      const node = resolveNode(payload.nodeId);
      const adapter = service?.getAdapterByKey(payload.adapterKey);
      if (!node || !adapter || !adapter.capabilities.canEdit) return false;

      if (payload.expectedSourceHash) {
        let currentContext;
        try {
          currentContext = adapter.readContext(node);
        } catch {
          return false;
        }
        if (!currentContext || currentContext.sourceHash !== payload.expectedSourceHash) {
          return false;
        }
      }

      let validation;
      try {
        validation = adapter.validate(node, payload.output);
      } catch {
        return false;
      }
      if (!validation.ok) return false;

      try {
        adapter.apply(node, validation.output, payload);
        applyNodeProvenance(node, payload);
        return true;
      } catch {
        // A plugin-owned adapter may reject an incompatible node state;
        // returning false lets the collaborative gateway report failure.
        return false;
      }
    },
    COMMAND_PRIORITY_EDITOR,
  );
  return () => {
    registeredEditors.delete(editor);
    unregister();
  };
};
