import { $wrapNodeInElement, mergeRegister } from '@lexical/utils';
import {
  $createParagraphNode,
  $insertNodes,
  $isRootOrShadowRoot,
  COMMAND_PRIORITY_HIGH,
  LexicalEditor,
  createCommand,
} from 'lexical';

import { $createMathInlineNode } from '../node/index';

export const INSERT_MATH_COMMAND = createCommand<{
  code: string;
}>('INSERT_MATH_COMMAND');

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
  );
}
