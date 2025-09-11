import type { IElementNode } from './i-element-node';
import type { INode } from './i-node';
import type { IParagraphNode } from './paragraph-node';
import type { IRootNode } from './root-node';
import type { ITextNode } from './text-node';

const BaseContent = {
  direction: 'ltr',
  format: '',
  indent: 0,
  type: '',
  version: 1,
};

export const INodeHelper = {
  appendChild(parent: IElementNode, ...child: INode[]): void {
    if (!parent.children) {
      parent.children = [];
    }
    parent.children.push(...child);
  },

  createElementNode(type: string, attrs: Record<string, unknown> = {}): IElementNode {
    return {
      ...BaseContent,
      children: [],
      ...attrs,
      type,
    } as IElementNode;
  },

  createLikeTextNode(type: string, text: string, attrs: Record<string, unknown> = {}): ITextNode {
    return {
      ...BaseContent,
      detail: 0,
      format: 0,
      mode: 'normal',
      style: '',
      ...attrs,
      text,
      type: type,
    };
  },

  createParagraph(attrs: Record<string, unknown> = {}): IParagraphNode {
    return {
      ...BaseContent,
      children: [],
      textFormat: 0,
      textStyle: '',
      ...attrs,
      type: 'paragraph',
    } as IParagraphNode;
  },

  createRootNode(attrs: Record<string, unknown> = {}): IRootNode {
    return {
      ...BaseContent,
      ...attrs,
      children: [],
      type: 'root',
    } as IRootNode;
  },

  createTextNode(text: string, attrs: Record<string, unknown> = {}): ITextNode {
    return {
      ...BaseContent,
      detail: 0,
      format: 0,
      mode: 'normal',
      style: '',
      ...attrs,
      text,
      type: 'text',
    };
  },

  createTypeNode(type: string, attrs: Record<string, unknown> = {}): INode {
    return {
      ...BaseContent,
      ...attrs,
      type,
    } as INode;
  },

  isParagraphNode(node: INode): node is IParagraphNode {
    return node.type === 'paragraph';
  },

  isRootNode(node: INode): node is IRootNode {
    return node.type === 'root';
  },

  isTextNode(node: INode): node is ITextNode {
    return node.type === 'text';
  },
};
