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
  createCommand,
} from 'lexical';

import { getKernelFromEditor } from '@/editor-kernel/utils';

import { HOVER_LINK_COMMAND, HOVER_OUT_LINK_COMMAND } from './LinkNode';

export interface LinkCardPayload {
  description?: string;
  icon?: string;
  openTarget?: null | string;
  title?: string;
  url: string;
}

export type SerializedLinkCardNode = Spread<
  {
    description: string;
    icon: string;
    openTarget: null | string;
    title: string;
    url: string;
  },
  SerializedLexicalNode
>;

export const EDIT_LINK_CARD_COMMAND = createCommand<{
  cardNode: LinkCardNode | null;
  cardNodeDOM: HTMLElement | null;
}>();

export class LinkCardNode extends DecoratorNode<unknown> {
  __url: string;
  __title: string;
  __icon: string;
  __description: string;
  __openTarget: null | string;

  static getType(): string {
    return 'link-card';
  }

  static clone(node: LinkCardNode): LinkCardNode {
    return new LinkCardNode(
      node.__url,
      node.__title,
      node.__icon,
      node.__description,
      node.__openTarget,
      node.__key,
    );
  }

  static importJSON(serializedNode: SerializedLinkCardNode): LinkCardNode {
    return $createLinkCardNode({
      description: serializedNode.description,
      icon: serializedNode.icon,
      openTarget: serializedNode.openTarget,
      title: serializedNode.title,
      url: serializedNode.url,
    }).updateFromJSON(serializedNode);
  }

  static importDOM(): DOMConversionMap | null {
    return {
      a: (node) => {
        if (node instanceof HTMLAnchorElement && node.dataset.linkCard === 'true') {
          return {
            conversion: $convertLinkCardElement,
            priority: 2,
          };
        }
        return null;
      },
    };
  }

  constructor(
    url: string,
    title?: string,
    icon?: string,
    description?: string,
    openTarget?: null | string,
    key?: NodeKey,
  ) {
    super(key);
    this.__url = url;
    this.__title = title || url;
    this.__icon = icon || '';
    this.__description = description || '';
    this.__openTarget = openTarget ?? '_blank';
  }

  createDOM(config: EditorConfig, editor: LexicalEditor): HTMLElement {
    const element = document.createElement('span');
    element.dataset.linkCard = 'true';
    addClassNamesToElement(element, config.theme.linkCard);
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

  isInline(): true {
    return true;
  }

  isKeyboardSelectable(): true {
    return true;
  }

  exportDOM(): DOMExportOutput {
    const element = document.createElement('a');
    element.dataset.linkCard = 'true';
    element.dataset.icon = this.getIcon();
    element.dataset.description = this.getDescription();
    if (this.getOpenTarget()) element.target = this.getOpenTarget()!;
    element.href = this.getURL();
    element.textContent = this.getTitle();
    return { element };
  }

  exportJSON(): SerializedLinkCardNode {
    return {
      ...super.exportJSON(),
      description: this.getDescription(),
      icon: this.getIcon(),
      openTarget: this.getOpenTarget(),
      title: this.getTitle(),
      url: this.getURL(),
    };
  }

  updateFromJSON(serializedNode: LexicalUpdateJSON<SerializedLinkCardNode>): this {
    return super
      .updateFromJSON(serializedNode)
      .setURL(serializedNode.url)
      .setTitle(serializedNode.title)
      .setIcon(serializedNode.icon)
      .setDescription(serializedNode.description)
      .setOpenTarget(serializedNode.openTarget ?? '_blank');
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

  getTitle(): string {
    return this.getLatest().__title || this.getURL();
  }

  setTitle(title?: string): this {
    const writable = this.getWritable();
    writable.__title = title || this.getURL();
    return writable;
  }

  getIcon(): string {
    return this.getLatest().__icon;
  }

  setIcon(icon?: string): this {
    const writable = this.getWritable();
    writable.__icon = icon || '';
    return writable;
  }

  getDescription(): string {
    return this.getLatest().__description;
  }

  setDescription(description?: string): this {
    const writable = this.getWritable();
    writable.__description = description || '';
    return writable;
  }

  getOpenTarget(): null | string {
    return this.getLatest().__openTarget;
  }

  setOpenTarget(openTarget?: null | string): this {
    const writable = this.getWritable();
    writable.__openTarget = openTarget ?? '_blank';
    return writable;
  }

  decorate(editor: LexicalEditor): unknown {
    const decorator = getKernelFromEditor(editor)?.getDecorator(LinkCardNode.getType());
    if (!decorator) return null;
    if (typeof decorator === 'function') return decorator(this, editor);
    return decorator.render(this, editor);
  }
}

export function $createLinkCardNode(payload: LinkCardPayload): LinkCardNode {
  return $applyNodeReplacement(
    new LinkCardNode(
      payload.url,
      payload.title,
      payload.icon,
      payload.description,
      payload.openTarget,
    ),
  );
}

function $convertLinkCardElement(domNode: Node): DOMConversionOutput {
  const element = domNode as HTMLAnchorElement;
  return {
    node: $createLinkCardNode({
      description: element.dataset.description,
      icon: element.dataset.icon,
      openTarget: element.getAttribute('target'),
      title: element.textContent || element.href,
      url: element.getAttribute('href') || '',
    }),
  };
}

export function $isLinkCardNode(node: LexicalNode | null | undefined): node is LinkCardNode {
  return node instanceof LinkCardNode || node?.getType?.() === LinkCardNode.getType();
}
