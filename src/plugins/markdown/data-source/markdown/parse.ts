import type { Heading, Html, Paragraph, PhrasingContent, Root, RootContent, Text } from 'mdast';
import { remark } from 'remark';
import remarkCjkFriendly from 'remark-cjk-friendly';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';

import type { IElementNode, INode, IRootNode, ITextNode } from '@/editor-kernel/inode';
import { INodeHelper } from '@/editor-kernel/inode/helper';

import { logger } from '../../utils/logger';
import { selfClosingHtmlTags, splitHtmlBlock } from './html';

export type MarkdownReadNode = INode | ITextNode | IElementNode;

export type MarkdownNode = Root | RootContent | PhrasingContent;
export type MarkdownNodeType = MarkdownNode['type'];

export type MarkdownReaderFunc<K> = (
  node: Extract<MarkdownNode, { type: K }>,
  children: MarkdownReadNode[],
  index: number,
) => MarkdownReadNode | MarkdownReadNode[] | false;

// 使用条件类型确保类型匹配
export type TransformerRecord = {
  [K in MarkdownNode['type']]?: MarkdownReaderFunc<K> | Array<MarkdownReaderFunc<K>>;
};

export type TransfromerRecordArray = {
  [K in MarkdownNode['type']]?: Array<MarkdownReaderFunc<K>>;
};

interface MarkdownContext {
  markdown: string;
}

export interface IHTMLStack {
  children: Array<MarkdownReadNode[] | MarkdownReadNode | null>;
  index: number;
  isEndTag: boolean;
  node: Html;
  tag: string;
}

const getNodeRawMarkdown = (node: Root | RootContent, markdown: string) => {
  const start = node.position?.start.offset;
  const end = node.position?.end.offset;

  if (typeof start === 'number' && typeof end === 'number') {
    return markdown.slice(start, end);
  }

  if ('value' in node && typeof node.value === 'string') {
    return node.value;
  }

  return '';
};

const createFallbackRawNode = (
  node: Root | RootContent,
  ctx: MarkdownContext,
  parentType: MarkdownNodeType | null,
): MarkdownReadNode | null => {
  const raw = getNodeRawMarkdown(node, ctx.markdown);
  if (!raw) return null;

  if (parentType === null || parentType === 'root') {
    return {
      ...INodeHelper.createParagraph(),
      children: [INodeHelper.createTextNode(raw)],
    };
  }

  return INodeHelper.createTextNode(raw);
};

function convertMdastToLexical(
  node: Root | RootContent,
  index: number,
  ctx: MarkdownContext,
  markdownReaders: TransformerRecord = {},
  parentType: MarkdownNodeType | null = null,
): MarkdownReadNode | MarkdownReadNode[] | null {
  switch (node.type) {
    case 'text': {
      const textNode = INodeHelper.createTextNode((node as Text).value);
      return textNode;
    }

    default: {
      if (!markdownReaders[node.type]) {
        return createFallbackRawNode(node, ctx, parentType);
      }

      let children: MarkdownReadNode[] = [];
      if ('children' in node && Array.isArray(node.children)) {
        const htmlStack: Array<IHTMLStack> = []; // 当前循环是否包含 HTML 标签
        const result: MarkdownReadNode[] = [];
        const append = (nodes: MarkdownReadNode | MarkdownReadNode[] | null) => {
          const target = htmlStack.at(-1)?.children ?? result;
          if (nodes) target.push(...(Array.isArray(nodes) ? nodes : [nodes]));
        };
        const readHtml = (html: Html, children: MarkdownReadNode[], index: number) => {
          const readers = markdownReaders.html;
          for (const reader of Array.isArray(readers) ? readers : readers ? [readers] : []) {
            const value = reader(html, children, index);
            if (value) return value;
          }
          return null;
        };
        const processHtml = (child: Html, index: number) => {
          if (!markdownReaders.html) {
            append(INodeHelper.createTextNode(child.value));
            return;
          }
          if (child.value.startsWith('<!--') && child.value.endsWith('-->')) return;

          const parts = splitHtmlBlock(child.value);
          if (parts.length > 1) {
            for (const part of parts) {
              if (part.html) processHtml({ type: 'html', value: part.value }, index);
              else if (part.value.trim()) {
                append(parseMarkdownToLexical(part.value, markdownReaders).children);
              }
            }
            return;
          }

          const tag = getHtmlTagName(child.value);
          const pairedTag = child.value.match(
            /^(<[a-z][^>"']*(?:(?:"[^"]*"|'[^']*')[^>"']*)*>)([\s\S]*)<\/\s*[a-z0-9-]+\s*>$/i,
          );
          if (pairedTag) {
            let children: MarkdownReadNode[] = parseMarkdownToLexical(
              pairedTag[2],
              markdownReaders,
            ).children;
            if (tag !== 'details') {
              children = children.flatMap((node) =>
                node.type === 'paragraph' && 'children' in node
                  ? (node.children as MarkdownReadNode[])
                  : [node],
              );
            }
            append(
              readHtml({ ...child, value: pairedTag[1] }, children, index) ??
                INodeHelper.createTextNode(child.value),
            );
            return;
          }
          if (selfClosingHtmlTags.has(tag)) {
            append(readHtml(child, [], index));
            return;
          }
          if (child.value.startsWith('</')) {
            const top = htmlStack.at(-1);
            if (!top || top.tag !== tag) {
              logger.warn('HTML tag mismatch:', tag);
              append(INodeHelper.createTextNode(child.value));
              return;
            }
            htmlStack.pop();
            const children = top.children.flat().filter(Boolean) as MarkdownReadNode[];
            append(readHtml(top.node, children, top.index) ?? children);
            return;
          }
          htmlStack.push({ children: [], index, isEndTag: false, node: child, tag });
        };

        for (const [index, child] of node.children.entries()) {
          if (child.type === 'html') processHtml(child, index);
          else append(convertMdastToLexical(child, index, ctx, markdownReaders, node.type));
        }
        while (htmlStack.length > 0) {
          const top = htmlStack.pop()!;
          append([
            INodeHelper.createTextNode(top.node.value),
            ...(top.children.flat().filter(Boolean) as MarkdownReadNode[]),
          ]);
        }
        children = result;
      }

      if (markdownReaders[node.type]) {
        const reader = markdownReaders[node.type];

        if (Array.isArray(reader)) {
          for (const element of reader) {
            const inode = element(node as unknown as any, children, index);
            if (inode) {
              return inode;
            }
          }
        } else if (typeof reader === 'function') {
          const inode = reader(node as unknown as any, children, index);
          if (inode) {
            return inode;
          }
        }
      }

      // Fallback for unsupported nodes
      return children || null;
    }
  }
}

function getHtmlTagName(value: string): string {
  const match = value.match(/^<\/?\s*([a-z0-9-]+)/i);
  return match?.[1]?.toLowerCase() || value.replaceAll(/^<\/?|>$/g, '');
}

function registerDefaultReaders(markdownReaders: TransformerRecord) {
  if (!markdownReaders['root']) {
    markdownReaders['root'] = (node: Root, children: MarkdownReadNode[]) => {
      return {
        ...INodeHelper.createRootNode(),
        children,
      };
    };
  }
  if (!markdownReaders['paragraph']) {
    markdownReaders['paragraph'] = (node: Paragraph, children: MarkdownReadNode[]) => {
      return {
        ...INodeHelper.createParagraph(),
        children,
      };
    };
  }
  if (!markdownReaders['heading']) {
    markdownReaders['heading'] = (node: Heading, children: MarkdownReadNode[]) => {
      const headingType = `h${Math.min(Math.max(node.depth, 1), 6)}`;
      return INodeHelper.createElementNode('heading', {
        children,
        direction: 'ltr',
        format: '',
        indent: 0,
        tag: headingType,
      });
    };
  }
}

export function parseMarkdownToLexical(
  markdown: string,
  markdownReaders: TransformerRecord = {},
): IRootNode {
  const ast = remark()
    .use(remarkCjkFriendly)
    .use(remarkMath)
    .use([[remarkGfm, { singleTilde: false }]])
    .parse(markdown);
  logger.debug('Parsed MDAST:', ast);

  const ctx: MarkdownContext = { markdown };
  registerDefaultReaders(markdownReaders);

  return convertMdastToLexical(ast, 0, ctx, markdownReaders) as IRootNode;
}
