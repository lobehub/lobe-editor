/* eslint-disable @typescript-eslint/no-use-before-define */
import { addClassNamesToElement } from '@lexical/utils';
import {
  $applyNodeReplacement,
  DOMConversionMap,
  DOMConversionOutput,
  DOMExportOutput,
  DecoratorNode,
  EditorConfig,
  LexicalEditor,
  LexicalNode,
  LexicalUpdateJSON,
  NodeKey,
  SerializedLexicalNode,
  Spread,
} from 'lexical';

import { getKernelFromEditor } from '@/editor-kernel/utils';

import { HOVER_LINK_COMMAND, HOVER_OUT_LINK_COMMAND } from './LinkNode';

export interface LinkIframePayload {
  src?: string;
  title?: string;
  url: string;
}

export type SerializedLinkIframeNode = Spread<
  {
    src: string;
    title: string;
    url: string;
  },
  SerializedLexicalNode
>;

export class LinkIframeNode extends DecoratorNode<unknown> {
  __url: string;
  __src: string;
  __title: string;

  static getType(): string {
    return 'link-iframe';
  }

  static clone(node: LinkIframeNode): LinkIframeNode {
    return new LinkIframeNode(node.__url, node.__src, node.__title, node.__key);
  }

  static importJSON(serializedNode: SerializedLinkIframeNode): LinkIframeNode {
    return $createLinkIframeNode({
      src: serializedNode.src,
      title: serializedNode.title,
      url: serializedNode.url,
    }).updateFromJSON(serializedNode);
  }

  static importDOM(): DOMConversionMap | null {
    return {
      a: (node) => {
        if (node instanceof HTMLAnchorElement && node.dataset.linkIframe === 'true') {
          return {
            conversion: $convertLinkIframeElement,
            priority: 2,
          };
        }
        return null;
      },
    };
  }

  constructor(url: string, src?: string, title?: string, key?: NodeKey) {
    super(key);
    this.__url = url;
    this.__src = src || url;
    this.__title = title || url;
  }

  createDOM(config: EditorConfig, editor: LexicalEditor): HTMLElement {
    const element = document.createElement('div');
    element.dataset.linkIframe = 'true';
    addClassNamesToElement(element, config.theme.linkIframe);
    element.addEventListener('mouseenter', (event) => {
      if (event.target instanceof HTMLElement) {
        event.target.classList.add('hover');
        editor.dispatchCommand(HOVER_LINK_COMMAND, {
          event: event as MouseEvent,
          node: this,
        });
      }
    });
    element.addEventListener('mouseleave', (event) => {
      if (event.target instanceof HTMLElement) {
        event.target.classList.remove('hover');
        editor.dispatchCommand(HOVER_OUT_LINK_COMMAND, {
          event: event as MouseEvent,
        });
      }
    });
    return element;
  }

  updateDOM(): false {
    return false;
  }

  isInline(): false {
    return false;
  }

  exportDOM(): DOMExportOutput {
    const element = document.createElement('a');
    element.dataset.linkIframe = 'true';
    element.dataset.src = this.getSrc();
    element.href = this.getURL();
    element.textContent = this.getTitle();
    return { element };
  }

  exportJSON(): SerializedLinkIframeNode {
    return {
      ...super.exportJSON(),
      src: this.getSrc(),
      title: this.getTitle(),
      url: this.getURL(),
    };
  }

  updateFromJSON(serializedNode: LexicalUpdateJSON<SerializedLinkIframeNode>): this {
    return super
      .updateFromJSON(serializedNode)
      .setURL(serializedNode.url)
      .setSrc(serializedNode.src)
      .setTitle(serializedNode.title);
  }

  getTextContent(): string {
    return this.getTitle();
  }

  getURL(): string {
    return this.getLatest().__url;
  }

  setURL(url: string): this {
    const writable = this.getWritable();
    writable.__url = url;
    return writable;
  }

  getSrc(): string {
    return this.getLatest().__src || this.getURL();
  }

  setSrc(src?: string): this {
    const writable = this.getWritable();
    writable.__src = src || this.getURL();
    return writable;
  }

  getTitle(): string {
    return this.getLatest().__title || this.getURL();
  }

  setTitle(title?: string): this {
    const writable = this.getWritable();
    writable.__title = title || this.getURL();
    return writable;
  }

  decorate(editor: LexicalEditor): unknown {
    const decorator = getKernelFromEditor(editor)?.getDecorator(LinkIframeNode.getType());
    if (!decorator) return null;
    if (typeof decorator === 'function') return decorator(this, editor);
    return decorator.render(this, editor);
  }
}

export function $createLinkIframeNode(payload: LinkIframePayload): LinkIframeNode {
  return $applyNodeReplacement(new LinkIframeNode(payload.url, payload.src, payload.title));
}

function $convertLinkIframeElement(domNode: Node): DOMConversionOutput {
  const element = domNode as HTMLAnchorElement;
  return {
    node: $createLinkIframeNode({
      src: element.dataset.src,
      title: element.textContent || element.href,
      url: element.getAttribute('href') || '',
    }),
  };
}

export function $isLinkIframeNode(node: LexicalNode | null | undefined): node is LinkIframeNode {
  return node instanceof LinkIframeNode || node?.getType?.() === LinkIframeNode.getType();
}
