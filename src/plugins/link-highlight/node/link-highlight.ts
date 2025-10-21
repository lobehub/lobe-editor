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

export type SerializedLinkHighlightNode = SerializedElementNode;

export class LinkHighlightNode extends CardLikeElementNode {
  static getType(): string {
    return 'linkHighlight';
  }

  static clone(node: LinkHighlightNode): LinkHighlightNode {
    return new LinkHighlightNode(node.__key);
  }

  static importJSON(serializedNode: SerializedLinkHighlightNode): LinkHighlightNode {
    return $createLinkHighlightNode().updateFromJSON(serializedNode);
  }

  createDOM(config: EditorConfig, editor: LexicalEditor): HTMLElement {
    const element = document.createElement('span');
    // eslint-disable-next-line unicorn/prefer-dom-node-dataset
    element.setAttribute('data-lexical-key', this.getKey());
    const childContainer = document.createElement('ne-content');
    element.append(childContainer);
    addClassNamesToElement(element, config.theme.linkHighlight);

    // Add click handler to open link in new window
    element.addEventListener('click', (event) => {
      // Only handle left click without modifier keys
      if (event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey) {
        event.preventDefault();
        event.stopPropagation();

        // Read URL in editor context
        editor.read(() => {
          const url = this.getURL();
          if (url) {
            // Format URL to ensure it has proper protocol
            const formattedUrl = this.formatUrl(url);
            window.open(formattedUrl, '_blank', 'noopener,noreferrer');
          }
        });
      }
    });

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

  getDOMSlot(element: HTMLElement) {
    const neContent = element.querySelector<HTMLElement>('ne-content');
    if (!neContent) {
      throw new Error('LinkHighlightNode: ne-content not found');
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

  updateDOM(prevNode: LinkHighlightNode, dom: HTMLElement, config: EditorConfig): boolean {
    // Update the class names if theme has changed
    const prevTheme = prevNode ? prevNode : null;
    if (prevTheme !== this) {
      addClassNamesToElement(dom, config.theme.linkHighlight);
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

export function $createLinkHighlightNode(textContent?: string): LinkHighlightNode {
  const linkHighlightNode = $applyNodeReplacement(new LinkHighlightNode());
  const cursorNode = $createCursorNode();
  linkHighlightNode.append(cursorNode);
  if (textContent) {
    linkHighlightNode.append($createTextNode(textContent));
  }
  return linkHighlightNode;
}

export function $isLinkHighlightNode(node: unknown): node is LinkHighlightNode {
  return node instanceof LinkHighlightNode;
}

export function getLinkHighlightNode(node: LexicalNode) {
  if ($isCursorNode(node)) {
    const parent = node.getParent();
    if ($isLinkHighlightNode(parent)) {
      return parent;
    }
    if ($isLinkHighlightNode(node.getNextSibling())) {
      return node.getNextSibling();
    }
    if ($isLinkHighlightNode(node.getPreviousSibling())) {
      return node.getPreviousSibling();
    }
    return null;
  }
  if ($isLinkHighlightNode(node.getParent())) {
    return node.getParent();
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
      const linkHighlight = getLinkHighlightNode(focusNode);
      if (linkHighlight !== getLinkHighlightNode(anchorNode)) {
        return false;
      }
      if ($isLinkHighlightNode(linkHighlight)) {
        return true;
      }
      return false;
    } else if ($isNodeSelection(selection)) {
      const nodes = selection.getNodes();
      if (nodes.length === 1 && $isLinkHighlightNode(nodes[0])) {
        return true;
      }
    }
    return false;
  });
}
