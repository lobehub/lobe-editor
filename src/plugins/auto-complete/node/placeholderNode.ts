import { addClassNamesToElement } from '@lexical/utils';
import type { EditorConfig, SerializedElementNode } from 'lexical';
import { $applyNodeReplacement, ElementNode } from 'lexical';

export type SerializedPlaceholderNode = SerializedElementNode;

export class PlaceholderNode extends ElementNode {
  static getType(): string {
    return 'PlaceholderInline';
  }

  static clone(node: PlaceholderNode): PlaceholderNode {
    return new PlaceholderNode(node.__key);
  }

  static importJSON(serializedNode: SerializedPlaceholderNode): PlaceholderNode {
    return $createPlaceholderNode().updateFromJSON(serializedNode);
  }

  createDOM(config: EditorConfig): HTMLElement {
    // This transient wrapper can contain block DOM to preserve multiline
    // layout without splitting the host paragraph. Such nesting is not a
    // portable HTML serialization; `display: inline-block` would not change
    // the HTML content model. Acceptance reparses the source Markdown instead
    // of reusing this wrapper's innerHTML.
    const element = document.createElement('span');
    element.contentEditable = 'false';
    element.setAttribute('data-auto-complete-preview', 'true');
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

/** Legacy node type kept for deserializing previews saved by older versions. */
export class PlaceholderBlockNode extends ElementNode {
  static getType(): string {
    return 'PlaceholderBlock';
  }

  static clone(node: PlaceholderBlockNode): PlaceholderBlockNode {
    return new PlaceholderBlockNode(node.__key);
  }

  static importJSON(serializedNode: SerializedPlaceholderNode): PlaceholderBlockNode {
    return $createPlaceholderBlockNode().updateFromJSON(serializedNode);
  }

  createDOM(config: EditorConfig): HTMLElement {
    const element = document.createElement('div');

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
