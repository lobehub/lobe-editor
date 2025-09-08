import { CAN_USE_DOM, mergeRegister } from '@lexical/utils';
import { COMMAND_PRIORITY_HIGH, LexicalEditor, SELECTION_CHANGE_COMMAND } from 'lexical';

import { $getNodeFromDOMNode } from '@/editor-kernel/utils';

export function patchBreakLine() {
  // ignore
}

function getElement(node: Node) {
  if (node.nodeType === Node.ELEMENT_NODE) {
    return node as HTMLElement;
  }
  return node.parentElement;
}

export function registerBreakLineClick(editor: LexicalEditor) {
  return mergeRegister(
    editor.registerCommand(
      SELECTION_CHANGE_COMMAND,
      () => {
        if (CAN_USE_DOM) {
          const sel = document.getSelection();
          if (sel?.anchorNode) {
            const node = getElement(sel.anchorNode);
            if (node?.hasAttribute('data-lexical-linebreak') && node.parentElement) {
              const p = node.parentElement;
              editor.update(() => {
                const elem = $getNodeFromDOMNode(p, editor);
                if (elem) {
                  elem.selectEnd();
                }
              });
              return true;
            }
          }
        }
        return false;
      },
      COMMAND_PRIORITY_HIGH,
    ),
  );
}
