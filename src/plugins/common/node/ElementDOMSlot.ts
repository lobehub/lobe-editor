import { CAN_USE_DOM, mergeRegister } from '@lexical/utils';
import {
  COMMAND_PRIORITY_HIGH,
  ElementDOMSlot,
  LexicalEditor,
  SELECTION_CHANGE_COMMAND,
} from 'lexical';
import { LexicalPrivateDOM } from 'lexical/LexicalNode';

import { $getNodeFromDOMNode } from '@/editor-kernel/utils';

export function patchBreakLine() {
  // 插入一个可以容纳光标的 breakline

  ElementDOMSlot.prototype.insertManagedLineBreak = function (webkitHack: boolean) {
    const prevBreak = this.getManagedLineBreak();
    if (prevBreak) {
      if (webkitHack === (prevBreak.nodeName === 'IMG')) {
        return;
      }
      this.removeManagedLineBreak();
    }
    const element: HTMLElement & LexicalPrivateDOM = this.element;
    const before = this.before;
    const br = document.createElement('span');
    // eslint-disable-next-line unicorn/prefer-dom-node-dataset
    br.setAttribute('data-lexical-linebreak', 'true');
    br.innerHTML = '&#xFEFF;<br>';
    // br.append(document.createElement('br'));
    // eslint-disable-next-line unicorn/prefer-modern-dom-apis
    element.insertBefore(br, before);
    if (webkitHack) {
      const img = document.createElement('img');
      // eslint-disable-next-line unicorn/prefer-dom-node-dataset
      img.setAttribute('data-lexical-linebreak', 'true');
      img.style.cssText =
        'display: inline !important; border: 0px !important; margin: 0px !important;';
      img.alt = '';
      // eslint-disable-next-line unicorn/prefer-modern-dom-apis
      element.insertBefore(img, br);
      element.__lexicalLineBreak = img;
    } else {
      // @ts-expect-error not error
      element.__lexicalLineBreak = br;
    }
  };
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
