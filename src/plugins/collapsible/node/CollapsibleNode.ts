/* eslint-disable @typescript-eslint/no-use-before-define */
import { addClassNamesToElement } from '@lexical/utils';
import {
  $applyNodeReplacement,
  $createParagraphNode,
  $createTextNode,
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
const TOGGLE_SELECTOR = '[data-collapsible-toggle="true"]';

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
    const node = $createCollapsibleNode(serializedNode.title || 'Details').updateFromJSON(serializedNode);
    if (shouldPrependTitle(serializedNode)) {
      const titleParagraph = $createTitleParagraph(serializedNode.title || 'Details');
      const firstChild = node.getFirstChild();
      if (firstChild) {
        firstChild.insertBefore(titleParagraph);
      } else {
        node.append(titleParagraph);
      }
    }
    return node;
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
    element.dataset.collapsibleCollapsed = String(this.__collapsed);

    const toggle = document.createElement('button');
    toggle.type = 'button';
    toggle.contentEditable = 'false';
    toggle.dataset.collapsibleToggle = 'true';
    toggle.setAttribute('aria-expanded', String(!this.__collapsed));
    toggle.setAttribute('aria-label', this.__collapsed ? 'Expand collapsible block' : 'Collapse collapsible block');
    toggle.addEventListener('click', () => {
      editor.update(() => {
        const latest = this.getLatest();
        if ($isCollapsibleNode(latest)) {
          latest.setCollapsed(!latest.isCollapsed());
        }
      });
    });

    const content = document.createElement('div');
    content.dataset.collapsibleContent = 'true';

    element.append(toggle, content);
    return element;
  }

  updateDOM(prevNode: this, dom: HTMLElement): boolean {
    const toggle = dom.querySelector<HTMLElement>(TOGGLE_SELECTOR);
    dom.dataset.collapsibleCollapsed = String(this.__collapsed);

    if (toggle && prevNode.__collapsed !== this.__collapsed) {
      toggle.setAttribute('aria-expanded', String(!this.__collapsed));
      toggle.setAttribute(
        'aria-label',
        this.__collapsed ? 'Expand collapsible block' : 'Collapse collapsible block',
      );
    }

    return false;
  }

  exportDOM(): DOMExportOutput {
    const element = document.createElement('details');
    if (!this.__collapsed) {
      element.setAttribute('open', '');
    }
    const summary = document.createElement('summary');
    summary.textContent = this.getTitle();
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
    const latest = this.getLatest();
    const firstChild = latest.getFirstChild();
    return firstChild ? firstChild.getTextContent().trim() : latest.__title;
  }

  isCollapsed(): boolean {
    return this.getLatest().__collapsed;
  }

  isShadowRoot(): boolean {
    return true;
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

function $createTitleParagraph(title: string) {
  const paragraph = $createParagraphNode();
  paragraph.append($createTextNode(title));
  return paragraph;
}

function getSerializedText(node: unknown): string {
  if (!node || typeof node !== 'object') return '';
  if ('text' in node && typeof node.text === 'string') return node.text;
  if ('children' in node && Array.isArray(node.children)) {
    return node.children.map((child) => getSerializedText(child)).join('');
  }
  return '';
}

function shouldPrependTitle(serializedNode: SerializedCollapsibleNode): boolean {
  const title = serializedNode.title?.trim();
  if (!title) return false;

  const children = Array.isArray(serializedNode.children) ? serializedNode.children : [];
  const firstChild = children[0];
  return getSerializedText(firstChild).trim() !== title;
}
