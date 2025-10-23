/* eslint-disable @typescript-eslint/no-use-before-define */
import { addClassNamesToElement } from '@lexical/utils';
import {
  $applyNodeReplacement,
  $getSelection,
  $isNodeSelection,
  $isRangeSelection,
  EditorConfig,
  ElementNode,
  LexicalEditor,
  LexicalNode,
  SerializedElementNode,
} from 'lexical';

export type SerializedLinkHighlightNode = SerializedElementNode;

export class LinkHighlightNode extends ElementNode {
  static getType(): string {
    return 'linkHighlight';
  }

  static clone(node: LinkHighlightNode): LinkHighlightNode {
    return new LinkHighlightNode(node.__key);
  }

  static importJSON(serializedNode: SerializedLinkHighlightNode): LinkHighlightNode {
    return $createLinkHighlightNode().updateFromJSON(serializedNode);
  }

  createDOM(config: EditorConfig): HTMLElement {
    const element = document.createElement('a');

    // Set link attributes
    const url = this.getURL();
    if (url) {
      element.href = this.formatUrl(url);
    }
    element.setAttribute('target', '_blank');
    element.setAttribute('rel', 'noopener noreferrer');

    addClassNamesToElement(element, config.theme.linkHighlight);

    return element;
  }

  /**
   * Format URL to ensure it has proper protocol
   */
  private formatUrl(url: string): string {
    // Check if URL already has a protocol
    if (/^[a-z][\d+.a-z-]*:/i.test(url)) {
      return url;
    }
    // Check if it's a relative path
    if (/^[#./]/.test(url)) {
      return url;
    }
    // Check for email address
    if (url.includes('@') && !url.startsWith('mailto:')) {
      return `mailto:${url}`;
    }
    // Check for phone number
    if (/^\+?[\d\s()-]{5,}$/.test(url)) {
      return `tel:${url}`;
    }
    // Default to https
    if (url.startsWith('www.')) {
      return `https://${url}`;
    }
    // If no protocol, assume https
    if (!url.includes('://')) {
      return `https://${url}`;
    }
    return url;
  }

  canBeEmpty(): false {
    return false;
  }

  isInline(): true {
    return true;
  }

  canInsertTextBefore(): false {
    return false;
  }

  canInsertTextAfter(): false {
    return false;
  }

  updateDOM(prevNode: LinkHighlightNode, dom: HTMLElement, config: EditorConfig): boolean {
    // Update the class names if theme has changed
    const prevTheme = prevNode ? prevNode : null;
    if (prevTheme !== this) {
      addClassNamesToElement(dom, config.theme.linkHighlight);
    }

    // Update href attribute if it's an anchor element
    if (dom instanceof HTMLAnchorElement) {
      const url = this.getURL();
      if (url) {
        dom.href = this.formatUrl(url);
      } else {
        dom.removeAttribute('href');
      }
    }

    return false;
  }

  /**
   * Get the URL from the text content
   */
  getURL(): string {
    return this.getTextContent().trim();
  }
}

export function $createLinkHighlightNode(): LinkHighlightNode {
  return $applyNodeReplacement(new LinkHighlightNode());
}

export function $isLinkHighlightNode(node: unknown): node is LinkHighlightNode {
  return node instanceof LinkHighlightNode;
}

export function getLinkHighlightNode(node: LexicalNode): LinkHighlightNode | null {
  if ($isLinkHighlightNode(node)) {
    return node;
  }
  const parent = node.getParent();
  if ($isLinkHighlightNode(parent)) {
    return parent;
  }
  return null;
}

export function $isSelectionInLinkHighlight(editor: LexicalEditor): boolean {
  return editor.read(() => {
    const selection = $getSelection();
    if (!selection) {
      return false;
    }

    if ($isRangeSelection(selection)) {
      const focusNode = selection.focus.getNode();
      const anchorNode = selection.anchor.getNode();
      const focusLinkHighlight = getLinkHighlightNode(focusNode);
      const anchorLinkHighlight = getLinkHighlightNode(anchorNode);

      // Both nodes should be in the same link-highlight node
      return (
        focusLinkHighlight !== null &&
        anchorLinkHighlight !== null &&
        focusLinkHighlight === anchorLinkHighlight
      );
    }

    if ($isNodeSelection(selection)) {
      const nodes = selection.getNodes();
      return nodes.length === 1 && $isLinkHighlightNode(nodes[0]);
    }

    return false;
  });
}
