import { $wrapNodeInElement, mergeRegister } from '@lexical/utils';
import {
  $createParagraphNode,
  $getNodeByKey,
  $insertNodes,
  $isRootOrShadowRoot,
  COMMAND_PRIORITY_HIGH,
  LexicalEditor,
  createCommand,
} from 'lexical';

import { $createMathInlineNode, MathInlineNode } from '../node/index';

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
        editor.update(() => {
          const mathCode = $getNodeByKey<MathInlineNode>(key);
          if (mathCode) {
            mathCode.updateCode(code);
            mathCode.selectNext();
          }
        });
        return true;
      },
      COMMAND_PRIORITY_HIGH, // Priority
    ),
    editor.registerCommand(
      SELECT_MATH_SIDE_COMMAND,
      (payload) => {
        const { key, prev } = payload;
        editor.update(() => {
          const mathNode = $getNodeByKey<MathInlineNode>(key);
          if (mathNode) {
            if (prev) {
              mathNode.selectPrevious();
            } else {
              mathNode.selectNext();
            }
          }
        });
        return true;
      },
      COMMAND_PRIORITY_HIGH, // Priority
    ),
  );
}
