/* eslint-disable @typescript-eslint/no-use-before-define */
import { addClassNamesToElement } from '@lexical/utils';
import {
  $applyNodeReplacement,
  $createTextNode,
  EditorConfig,
  SerializedElementNode,
} from 'lexical';

import { $createCursorNode, CardLikeElementNode } from '@/plugins/common';

export type SerializedCodeNode = SerializedElementNode;

export class CodeNode extends CardLikeElementNode {
  static getType(): string {
    return 'codeInline';
  }

  static clone(node: CodeNode): CodeNode {
    return new CodeNode(node.__key);
  }

  static importJSON(serializedNode: SerializedCodeNode): CodeNode {
    return $createCodeNode().updateFromJSON(serializedNode);
  }

  createDOM(config: EditorConfig): HTMLElement {
    const element = document.createElement('span');
    // eslint-disable-next-line unicorn/prefer-dom-node-dataset
    element.setAttribute('data-lexical-key', this.getKey());
    // const filler = document.createElement('t-filler');
    // filler.contentEditable = 'false';
    // filler.innerHTML = '\uFEFF';
    // eslint-disable-next-line unicorn/prefer-dom-node-dataset
    // filler.setAttribute('data-lexical-cursor', 'true');
    // element.append(filler);
    const childContainer = document.createElement('ne-content');
    element.append(childContainer);
    addClassNamesToElement(element, config.theme.codeInline);
    return element;
  }

  getDOMSlot(element: HTMLElement) {
    const neContent = element.querySelector<HTMLElement>('ne-content');
    if (!neContent) {
      throw new Error('CodeNode: ne-content not found');
    }
    return super.getDOMSlot(element).withElement(neContent);
  }

  canBeEmpty(): boolean {
    return false;
  }

  isCardLike(): boolean {
    return true;
  }

  isInline(): boolean {
    return true;
  }

  canIndent(): boolean {
    return false;
  }

  canInsertTextBefore(): boolean {
    return true;
  }

  canInsertTextAfter(): boolean {
    return true;
  }
}

export function $createCodeNode(textContent?: string): CodeNode {
  const codeNode = $applyNodeReplacement(new CodeNode());
  const cursorNode = $createCursorNode();
  codeNode.append(cursorNode);
  if (textContent) {
    codeNode.append($createTextNode(textContent));
  }
  return codeNode;
}

export function $isCodeInlineNode(node: unknown): node is CodeNode {
  return node instanceof CodeNode;
}
