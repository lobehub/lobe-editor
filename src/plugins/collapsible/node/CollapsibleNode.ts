/* eslint-disable @typescript-eslint/no-use-before-define */
import { addClassNamesToElement } from '@lexical/utils';
import {
  $applyNodeReplacement,
  DOMConversionMap,
  DOMConversionOutput,
  DOMExportOutput,
  EditorConfig,
  ElementDOMSlot,
  ElementNode,
  LexicalEditor,
  LexicalNode,
  LexicalUpdateJSON,
  NodeKey,
  SerializedElementNode,
  Spread,
} from 'lexical';

export type SerializedCollapsibleNode = Spread<
  {
    collapsed: boolean;
    title: string;
  },
  SerializedElementNode
>;

const CONTENT_SELECTOR = '[data-collapsible-content="true"]';

export class CollapsibleNode extends ElementNode {
  __collapsed: boolean;
  __title: string;

  static getType(): string {
    return 'collapsible';
  }

  static clone(node: CollapsibleNode): CollapsibleNode {
    return new CollapsibleNode(node.__title, node.__collapsed, node.__key);
  }

  static importDOM(): DOMConversionMap | null {
    return {
      details: () => ({
        conversion: $convertDetailsElement,
        priority: 1,
      }),
    };
  }

  static importJSON(serializedNode: SerializedCollapsibleNode): CollapsibleNode {
    return $createCollapsibleNode().updateFromJSON(serializedNode);
  }

  constructor(title: string = 'Details', collapsed: boolean = false, key?: NodeKey) {
    super(key);
    this.__title = title;
    this.__collapsed = collapsed;
  }

  createDOM(config: EditorConfig, editor: LexicalEditor): HTMLElement {
    const element = document.createElement('section');
    addClassNamesToElement(element, config.theme.collapsible);
    element.dataset.collapsible = 'true';

    const summary = document.createElement('button');
    summary.type = 'button';
    summary.contentEditable = 'false';
    summary.dataset.collapsibleSummary = 'true';
    summary.setAttribute('aria-expanded', String(!this.__collapsed));
    summary.textContent = this.__title;
    summary.addEventListener('click', () => {
      editor.update(() => {
        const latest = this.getLatest();
        if ($isCollapsibleNode(latest)) {
          latest.setCollapsed(!latest.isCollapsed());
        }
      });
    });

    const content = document.createElement('div');
    content.dataset.collapsibleContent = 'true';
    content.hidden = this.__collapsed;

    element.append(summary, content);
    return element;
  }

  updateDOM(prevNode: this, dom: HTMLElement): boolean {
    const summary = dom.querySelector<HTMLElement>('[data-collapsible-summary="true"]');
    const content = dom.querySelector<HTMLElement>(CONTENT_SELECTOR);

    if (summary && prevNode.__title !== this.__title) {
      summary.textContent = this.__title;
    }

    if (summary && prevNode.__collapsed !== this.__collapsed) {
      summary.setAttribute('aria-expanded', String(!this.__collapsed));
    }

    if (content && prevNode.__collapsed !== this.__collapsed) {
      content.hidden = this.__collapsed;
    }

    return false;
  }

  exportDOM(): DOMExportOutput {
    const element = document.createElement('details');
    if (!this.__collapsed) {
      element.setAttribute('open', '');
    }
    const summary = document.createElement('summary');
    summary.textContent = this.__title;
    element.append(summary);
    return { element };
  }

  exportJSON(): SerializedCollapsibleNode {
    return {
      ...super.exportJSON(),
      collapsed: this.isCollapsed(),
      title: this.getTitle(),
    };
  }

  getDOMSlot(element: HTMLElement): ElementDOMSlot<HTMLElement> {
    const content = element.querySelector(CONTENT_SELECTOR);
    if (content instanceof HTMLElement) {
      return super.getDOMSlot(element).withElement(content);
    }
    return super.getDOMSlot(element);
  }

  getTitle(): string {
    return this.getLatest().__title;
  }

  isCollapsed(): boolean {
    return this.getLatest().__collapsed;
  }

  setCollapsed(collapsed: boolean): this {
    const writable = this.getWritable();
    writable.__collapsed = collapsed;
    return writable;
  }

  setTitle(title: string): this {
    const writable = this.getWritable();
    writable.__title = title;
    return writable;
  }

  updateFromJSON(serializedNode: LexicalUpdateJSON<SerializedCollapsibleNode>): this {
    return super
      .updateFromJSON(serializedNode)
      .setTitle(serializedNode.title || 'Details')
      .setCollapsed(Boolean(serializedNode.collapsed));
  }
}

export function $createCollapsibleNode(
  title: string = 'Details',
  collapsed: boolean = false,
): CollapsibleNode {
  return $applyNodeReplacement(new CollapsibleNode(title, collapsed));
}

export function $isCollapsibleNode(
  node: LexicalNode | null | undefined,
): node is CollapsibleNode {
  return node instanceof CollapsibleNode;
}

function $convertDetailsElement(domNode: Node): DOMConversionOutput {
  if (!(domNode instanceof HTMLDetailsElement)) {
    return { node: null };
  }

  const title = domNode.querySelector('summary')?.textContent?.trim() || 'Details';
  return {
    node: $createCollapsibleNode(title, !domNode.open),
  };
}
