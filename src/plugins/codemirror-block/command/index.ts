import { $findMatchingParent, mergeRegister } from '@lexical/utils';
import {
  $createNodeSelection,
  $createParagraphNode,
  $getNodeByKey,
  $getSelection,
  $insertNodes,
  $isRangeSelection,
  $setSelection,
  COMMAND_PRIORITY_EDITOR,
  LexicalEditor,
  createCommand,
} from 'lexical';

import { UPDATE_CODEBLOCK_LANG } from '@/plugins/codeblock';

import { $createCodeMirrorNode, $isCodeMirrorNode } from '../node/CodeMirrorNode';

export const INSERT_CODEMIRROR_COMMAND = createCommand<unknown>('INSERT_CODEMIRROR_COMMAND');

export const SELECT_BEFORE_CODEMIRROR_COMMAND = createCommand<{ key: string }>(
  'SELECT_BEFORE_CODEMIRROR_COMMAND',
);

export const SELECT_AFTER_CODEMIRROR_COMMAND = createCommand<{ key: string }>(
  'SELECT_AFTER_CODEMIRROR_COMMAND',
);

export function registerCodeMirrorCommand(editor: LexicalEditor) {
  return mergeRegister(
    editor.registerCommand(
      INSERT_CODEMIRROR_COMMAND,
      () => {
        editor.update(() => {
          const codeMirrorNode = $createCodeMirrorNode('', '');
          $insertNodes([codeMirrorNode]);

          // Select the inserted CodeMirror node so the React decorator can
          // focus into the CodeMirror instance (caret stays "inside" the block).
          const selection = $createNodeSelection();
          selection.add(codeMirrorNode.getKey());
          $setSelection(selection);
        });
        return true;
      },
      COMMAND_PRIORITY_EDITOR, // Priority
    ),
    editor.registerCommand(
      UPDATE_CODEBLOCK_LANG,
      (payload) => {
        const codeMirrorNode = editor.getEditorState().read(() => {
          const selection = $getSelection();
          if ($isRangeSelection(selection)) {
            if (selection.isCollapsed()) {
              const node = $findMatchingParent(selection.anchor.getNode(), $isCodeMirrorNode);
              return node;
            } else {
              const anchor = $findMatchingParent(selection.anchor.getNode(), $isCodeMirrorNode);
              const focus = $findMatchingParent(selection.focus.getNode(), $isCodeMirrorNode);
              if (anchor && focus && anchor === focus) {
                return anchor;
              }
              return null;
            }
          }
          return false;
        });
        if (!codeMirrorNode) {
          return false;
        }
        // Need to defer execution due to possible transform execution order confusion from selection changes
        queueMicrotask(() => {
          editor.update(() => {
            if ($isCodeMirrorNode(codeMirrorNode)) {
              codeMirrorNode.setLang(payload.lang);
            }
          });
        });
        return true;
      },
      COMMAND_PRIORITY_EDITOR,
    ),
    editor.registerCommand(
      SELECT_BEFORE_CODEMIRROR_COMMAND,
      (payload) => {
        editor.update(() => {
          const node = $getNodeByKey(payload.key);
          if (!node) {
            return;
          }
          const prevNode = node.getPreviousSibling();
          const sel = prevNode?.selectEnd();
          console.info('SELECT_BEFORE_CODEMIRROR_COMMAND', prevNode, sel);
          if (sel) {
            $setSelection(sel);
          }
          editor.focus();
        });
        return false;
      },
      COMMAND_PRIORITY_EDITOR,
    ),
    editor.registerCommand(
      SELECT_AFTER_CODEMIRROR_COMMAND,
      (payload) => {
        editor.update(() => {
          const node = $getNodeByKey(payload.key);
          if (!node) {
            return;
          }
          const nextNode = node.getNextSibling();
          const selection = nextNode?.selectStart();

          // If there is no next sibling (e.g. codeblock at end), create a new paragraph
          // after the codeblock and move caret into it.
          if (selection) {
            $setSelection(selection);
          } else {
            const paragraph = $createParagraphNode();
            node.insertAfter(paragraph);
            const paragraphSelection = paragraph.selectStart();
            if (paragraphSelection) {
              $setSelection(paragraphSelection);
            }
          }
          editor.focus();
        });
        return false;
      },
      COMMAND_PRIORITY_EDITOR,
    ),
  );
}
