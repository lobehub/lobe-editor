import { mergeRegister } from '@lexical/utils';
import type { LexicalEditor } from 'lexical';
import {
  $createNodeSelection,
  $createParagraphNode,
  $getNodeByKey,
  $insertNodes,
  $setSelection,
  COMMAND_PRIORITY_EDITOR,
  createCommand,
} from 'lexical';

import { $createHoleNode, $isHoleNode } from '@/plugins/common/node/hole';

import { $createArtifactNode } from '../node/ArtifactNode';

export interface InsertArtifactPayload {
  html?: string;
  title?: string;
}

export const INSERT_ARTIFACT_COMMAND = createCommand<InsertArtifactPayload | undefined>(
  'INSERT_ARTIFACT_COMMAND',
);
export const SELECT_BEFORE_ARTIFACT_COMMAND = createCommand<{ key: string }>(
  'SELECT_BEFORE_ARTIFACT_COMMAND',
);
export const SELECT_AFTER_ARTIFACT_COMMAND = createCommand<{ key: string }>(
  'SELECT_AFTER_ARTIFACT_COMMAND',
);

export function registerArtifactCommand(editor: LexicalEditor): () => void {
  return mergeRegister(
    editor.registerCommand(
      INSERT_ARTIFACT_COMMAND,
      (payload) => {
        editor.update(() => {
          const artifact = $createArtifactNode(payload?.html, payload?.title);
          const hole = $createHoleNode(artifact);
          $insertNodes([hole]);
          const selection = $createNodeSelection();
          selection.add(artifact.getKey());
          $setSelection(selection);
        });
        return true;
      },
      COMMAND_PRIORITY_EDITOR,
    ),
    editor.registerCommand(
      SELECT_BEFORE_ARTIFACT_COMMAND,
      ({ key }) => selectOutsideArtifact(editor, key, 'before'),
      COMMAND_PRIORITY_EDITOR,
    ),
    editor.registerCommand(
      SELECT_AFTER_ARTIFACT_COMMAND,
      ({ key }) => selectOutsideArtifact(editor, key, 'after'),
      COMMAND_PRIORITY_EDITOR,
    ),
  );
}

function selectOutsideArtifact(
  editor: LexicalEditor,
  key: string,
  direction: 'after' | 'before',
): boolean {
  editor.update(() => {
    const node = $getNodeByKey(key);
    if (!node) return;

    const hole = node.getParent();
    if ($isHoleNode(hole)) {
      hole.normalizeBoundaryCursors();
      const cursor = direction === 'before' ? hole.getBeforeCursor() : hole.getAfterCursor();
      if (cursor) {
        direction === 'before' ? cursor.selectEnd() : cursor.selectStart();
        return;
      }
    }

    const sibling = direction === 'before' ? node.getPreviousSibling() : node.getNextSibling();
    const selection = direction === 'before' ? sibling?.selectEnd() : sibling?.selectStart();
    if (selection) {
      $setSelection(selection);
      return;
    }

    const paragraph = $createParagraphNode();
    direction === 'before' ? node.insertBefore(paragraph) : node.insertAfter(paragraph);
    $setSelection(direction === 'before' ? paragraph.selectEnd() : paragraph.selectStart());
  });
  queueMicrotask(() => editor.focus());
  return true;
}
