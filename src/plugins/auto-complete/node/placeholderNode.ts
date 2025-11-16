import { addClassNamesToElement } from '@lexical/utils';
import { $applyNodeReplacement, EditorConfig, ElementNode, SerializedElementNode } from 'lexical';

export type SerializedPlaceholderNode = SerializedElementNode;

export class PlaceholderNode extends ElementNode {
  static getType(): string {
    return 'PlaceholderInline';
  }

  static clone(node: PlaceholderNode): PlaceholderNode {
    return new PlaceholderNode(node.__key);
  }

  static importJSON(serializedNode: SerializedPlaceholderNode): PlaceholderNode {
    // eslint-disable-next-line @typescript-eslint/no-use-before-define
    return $createPlaceholderNode().updateFromJSON(serializedNode);
  }

  createDOM(config: EditorConfig): HTMLElement {
    const element = document.createElement('span');
    // eslint-disable-next-line unicorn/prefer-dom-node-dataset
    element.setAttribute('data-lexical-key', this.getKey());
    addClassNamesToElement(element, config.theme.placeholderInline);
    return element;
  }

  updateDOM(prevNode: unknown, dom: HTMLElement, config: EditorConfig): boolean {
    // Update the class names if theme has changed
    const prevTheme = prevNode ? prevNode : null;
    if (prevTheme !== this) {
      addClassNamesToElement(dom, config.theme.placeholderInline);
    }
    return false;
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

export class PlaceholderBlockNode extends ElementNode {
  static getType(): string {
    return 'PlaceholderBlock';
  }

  static clone(node: PlaceholderBlockNode): PlaceholderBlockNode {
    return new PlaceholderBlockNode(node.__key);
  }

  static importJSON(serializedNode: SerializedPlaceholderNode): PlaceholderBlockNode {
    // eslint-disable-next-line @typescript-eslint/no-use-before-define
    return $createPlaceholderBlockNode().updateFromJSON(serializedNode);
  }

  createDOM(config: EditorConfig): HTMLElement {
    const element = document.createElement('div');
    // eslint-disable-next-line unicorn/prefer-dom-node-dataset
    element.setAttribute('data-lexical-key', this.getKey());
    addClassNamesToElement(element, config.theme.placeholderBlock);
    return element;
  }

  updateDOM(prevNode: unknown, dom: HTMLElement, config: EditorConfig): boolean {
    // Update the class names if theme has changed
    const prevTheme = prevNode ? prevNode : null;
    if (prevTheme !== this) {
      addClassNamesToElement(dom, config.theme.placeholderBlock);
    }
    return false;
  }

  canBeEmpty(): boolean {
    return false;
  }

  isCardLike(): boolean {
    return true;
  }

  isInline(): boolean {
    return false;
  }

  canIndent(): boolean {
    return false;
  }

  canInsertTextBefore(): boolean {
    return false;
  }

  canInsertTextAfter(): boolean {
    return false;
  }
}

export function $createPlaceholderNode(): PlaceholderNode {
  return $applyNodeReplacement(new PlaceholderNode());
}

export function $createPlaceholderBlockNode(): PlaceholderBlockNode {
  return $applyNodeReplacement(new PlaceholderBlockNode());
}
