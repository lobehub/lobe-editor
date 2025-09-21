/* eslint-disable unused-imports/no-unused-vars */
import type { PhrasingContent, Root, RootContent, Text } from 'mdast';
import { remark } from 'remark';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';

import type { IElementNode, INode, IRootNode, ITextNode } from '@/editor-kernel/inode';
import { INodeHelper } from '@/editor-kernel/inode/helper';

export type MarkdownReadNode = INode | ITextNode | IElementNode;

export type MarkdownNode = RootContent | PhrasingContent;

// 使用条件类型确保类型匹配
export type TransformerRecord = {
  [K in MarkdownNode['type']]?: (
    node: Extract<MarkdownNode, { type: K }>,
    children: MarkdownReadNode[],
    index: number,
  ) => MarkdownReadNode | MarkdownReadNode[];
};

function convertMdastToLexical(
  node: Root | RootContent,
  index: number,
  markdownReaders: TransformerRecord = {},
): MarkdownReadNode | MarkdownReadNode[] | null {
  switch (node.type) {
    case 'root': {
      return {
        ...INodeHelper.createRootNode(),
        children: node.children
          .map((child, index) => convertMdastToLexical(child, index, markdownReaders))
          .filter(Boolean)
          .flat() as INode[],
      };
    }

    case 'paragraph': {
      const paragraph = INodeHelper.createParagraph();
      return {
        ...paragraph,
        children: node.children
          .map((child, index) =>
            convertMdastToLexical(child as PhrasingContent, index, markdownReaders),
          )
          .filter(Boolean)
          .flat() as INode[],
      };
    }

    case 'heading': {
      // Create heading based on depth (h1-h6)
      const headingType = `h${Math.min(Math.max(node.depth, 1), 6)}`;
      return INodeHelper.createElementNode('heading', {
        children: node.children
          .map((child, index) =>
            convertMdastToLexical(child as PhrasingContent, index, markdownReaders),
          )
          .filter(Boolean)
          .flat() as INode[],
        direction: 'ltr',
        format: '',
        indent: 0,
        tag: headingType,
      });
    }

    case 'text': {
      return INodeHelper.createTextNode((node as Text).value);
    }

    default: {
      if (markdownReaders[node.type]) {
        let children: MarkdownReadNode[] = [];
        if ('children' in node && Array.isArray(node.children)) {
          children = node.children
            .map((child, index) =>
              convertMdastToLexical(child as PhrasingContent, index, markdownReaders),
            )
            .filter(Boolean)
            .flat() as MarkdownReadNode[];
        }
        const inode = markdownReaders[node.type]?.(node as unknown as any, children, index);
        if (inode) {
          return inode;
        }
      }

      // Fallback for unsupported nodes
      return null;
    }
  }
}

export function parseMarkdownToLexical(
  markdown: string,
  markdownReaders: TransformerRecord = {},
): IRootNode {
  const ast = remark()
    .use(remarkMath)
    .use([[remarkGfm, { singleTilde: false }]])
    .parse(markdown);
  console.info('mdast', ast);
  return convertMdastToLexical(ast, 0, markdownReaders) as IRootNode;
}
