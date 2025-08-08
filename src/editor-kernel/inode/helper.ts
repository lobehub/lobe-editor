import { IElementNode } from './i-element-node';
import { INode } from './i-node';
import { IParagraphNode } from './paragraph-node';
import { IRootNode } from './root-node';
import { ITextNode } from './text-node';

const BaseContent: INode = {
  direction: 'ltr',
  format: '',
  indent: 0,
  version: 1,
};

export const INodeHelper = {
  appendChild(parent: IElementNode, child: INode): void {
    if (!parent.children) {
      parent.children = [];
    }
    parent.children.push(child);
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
      mode: 'normal',
      style: '',
      ...attrs,
      text,
      type: 'text',
    };
  },
};
