/* eslint-disable @typescript-eslint/no-use-before-define */
import { addClassNamesToElement } from '@lexical/utils';
import {
  $applyNodeReplacement,
  $createTextNode,
  $getSelection,
  $isNodeSelection,
  $isRangeSelection,
  EditorConfig,
  LexicalEditor,
  LexicalNode,
  SerializedElementNode,
} from 'lexical';

import {
  $createCursorNode,
  $isCursorNode,
  CardLikeElementNode,
} from '@/plugins/common/node/cursor';

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

  updateDOM(prevNode: CodeNode, dom: HTMLElement, config: EditorConfig): boolean {
    // Update the class names if theme has changed
    const prevTheme = prevNode ? prevNode : null;
    if (prevTheme !== this) {
      addClassNamesToElement(dom, config.theme.codeInline);
    }
    return false;
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

export function getCodeInlineNode(node: LexicalNode) {
  if ($isCursorNode(node)) {
    const parent = node.getParent();
    if ($isCodeInlineNode(parent)) {
      return parent;
    }
    if ($isCodeInlineNode(node.getNextSibling())) {
      return node.getNextSibling();
    }
    if ($isCodeInlineNode(node.getPreviousSibling())) {
      return node.getPreviousSibling();
    }
    return null;
  }
  if ($isCodeInlineNode(node.getParent())) {
    return node.getParent();
  }
  return null;
}

export function $isSelectionInCodeInline(editor: LexicalEditor): boolean {
  return editor.read(() => {
    const selection = $getSelection();
    if (!selection) {
      return false;
    }
    if ($isRangeSelection(selection)) {
      const focusNode = selection.focus.getNode();
      const anchorNode = selection.anchor.getNode();
      const code = getCodeInlineNode(focusNode);
      if (code !== getCodeInlineNode(anchorNode)) {
        return false;
      }
      if ($isCodeInlineNode(code)) {
        return true;
      }
      return false;
    } else if ($isNodeSelection(selection)) {
      const nodes = selection.getNodes();
      if (nodes.length === 1 && $isCodeInlineNode(nodes[0])) {
        return true;
      }
    }
    return false;
  });
}
