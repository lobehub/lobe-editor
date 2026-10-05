import { $wrapNodeInElement, mergeRegister } from '@lexical/utils';
import type { LexicalEditor } from 'lexical';
import {
  $createParagraphNode,
  $getNodeByKey,
  $getSelection,
  $insertNodes,
  $isRootOrShadowRoot,
  COMMAND_PRIORITY_HIGH,
  createCommand,
} from 'lexical';

import { getKernelFromEditor } from '@/editor-kernel/utils';
import { IHoleService } from '@/plugins/common/service/i-hole-service';

import type { MathInlineNode } from '../node/index';
import { $createMathInlineNode, MathBlockNode } from '../node/index';

export const INSERT_MATH_COMMAND = createCommand<{
  code: string;
}>('INSERT_MATH_COMMAND');

export const UPDATE_MATH_COMMAND = createCommand<{
  code: string;
  key: string;
}>('UPDATE_MATH_COMMAND');

export const SELECT_MATH_SIDE_COMMAND = createCommand<{
  key: string;
  prev?: boolean;
}>('SELECT_MATH_SIDE_COMMAND');

export function registerMathCommand(editor: LexicalEditor) {
  return mergeRegister(
    editor.registerCommand(
      INSERT_MATH_COMMAND,
      (payload) => {
        const { code } = payload;
        editor.update(() => {
          const holeService = getKernelFromEditor(editor)?.requireService(IHoleService);
          const currentSelection = $getSelection();
          if (currentSelection) holeService?.prepareBoundaryInsertion(currentSelection);
          const mathNode = $createMathInlineNode(code);
          $insertNodes([mathNode]); // Insert a zero-width space to ensure the image is not the last child
          if ($isRootOrShadowRoot(mathNode.getParentOrThrow())) {
            $wrapNodeInElement(mathNode, $createParagraphNode).selectEnd();
          }
        });
        return true;
      },
      COMMAND_PRIORITY_HIGH, // Priority
    ),
    editor.registerCommand(
      UPDATE_MATH_COMMAND,
      (payload) => {
        const { code, key } = payload;
        let isBlock = false;
        editor.update(() => {
          const mathCode = $getNodeByKey<MathInlineNode>(key);
          if (mathCode) {
            mathCode.updateCode(code);
            isBlock = mathCode instanceof MathBlockNode;
            if (!isBlock) mathCode.selectNext();
          }
        });
        if (isBlock) {
          const holeService = getKernelFromEditor(editor)?.requireService(IHoleService);
          if (!holeService?.selectBoundary(key, 'after')) {
            editor.update(() => {
              $getNodeByKey<MathBlockNode>(key)?.selectNext();
            });
          }
        }
        return true;
      },
      COMMAND_PRIORITY_HIGH, // Priority
    ),
    editor.registerCommand(
      SELECT_MATH_SIDE_COMMAND,
      (payload) => {
        const { key, prev } = payload;
        const mathNode = editor.getEditorState().read(() => $getNodeByKey(key));
        if (mathNode instanceof MathBlockNode) {
          const holeService = getKernelFromEditor(editor)?.requireService(IHoleService);
          if (holeService?.selectBoundary(key, prev ? 'before' : 'after')) return true;
        }
        editor.update(() => {
          const inlineMathNode = $getNodeByKey<MathInlineNode>(key);
          if (inlineMathNode) {
            if (prev) {
              inlineMathNode.selectPrevious();
            } else {
              inlineMathNode.selectNext();
            }
          }
        });
        return true;
      },
      COMMAND_PRIORITY_HIGH, // Priority
    ),
  );
}
