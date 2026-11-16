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

/** Invisible Markdown transport marker used to preserve durable block IDs. */
export interface MarkdownNodeIdEntry {
  nodeId: string;
  path: number[];
}

export interface MarkdownNodeIdMarker {
  nodeId: string;
  type: '__lobe_node_id__';
  kind: 'node' | 'tree';
  entries?: MarkdownNodeIdEntry[];
}

const NODE_ID_MARKER = /^\s*<!--\s*lobe-node-id:([^\s]+)\s*-->\s*$/i;
const NODE_IDS_MARKER = /^\s*<!--\s*lobe-node-ids:([^\s]+)\s*-->\s*$/i;

const parseNodeIdMarker = (value: string): MarkdownNodeIdMarker | null => {
  const match = value.match(NODE_ID_MARKER);
  const nodeId = match?.[1]?.trim();
  return nodeId ? { kind: 'node', nodeId, type: '__lobe_node_id__' } : null;
};

const parseNodeIdsMarker = (value: string): MarkdownNodeIdMarker | null => {
  const match = value.match(NODE_IDS_MARKER);
  if (!match?.[1]) return null;

  try {
    const decoded = JSON.parse(decodeURIComponent(match[1])) as unknown;
    if (!Array.isArray(decoded)) return null;
    const entries = decoded.filter((entry): entry is MarkdownNodeIdEntry => {
      if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return false;
      const candidate = entry as { nodeId?: unknown; path?: unknown };
      return (
        typeof candidate.nodeId === 'string' &&
        candidate.nodeId.trim().length > 0 &&
        Array.isArray(candidate.path) &&
        candidate.path.every((part) => Number.isSafeInteger(part) && part >= 0)
      );
    });
    return entries.length > 0
      ? { entries, kind: 'tree', nodeId: '', type: '__lobe_node_id__' }
      : null;
  } catch {
    return null;
  }
};

const isNodeIdMarker = (
  node: MarkdownReadNode | MarkdownNodeIdMarker,
): node is MarkdownNodeIdMarker => node.type === '__lobe_node_id__';

const attachNodeId = (node: MarkdownReadNode, nodeId: string): void => {
  if (isNodeIdMarker(node) || !node || typeof node !== 'object') return;
  const record = node as INode & {
    $?: Record<string, unknown>;
    children?: MarkdownReadNode[];
  };
  const state = record.$ && typeof record.$ === 'object' ? record.$ : {};
  const properties =
    state.properties && typeof state.properties === 'object' && !Array.isArray(state.properties)
      ? state.properties
      : {};
  record.$ = {
    ...state,
    properties: {
      ...properties,
      nodeId,
    },
  };

  // Artifact Markdown is represented by a transparent runtime Hole. Keep
  // the identity on the logical payload as well as the wrapper so projected
  // JSON and later LiteXML output address the Artifact itself.
  if (record.type === 'hole' && Array.isArray(record.children)) {
    const content = record.children.find((child) => isRecordNode(child) && child.type !== 'cursor');
    if (content) attachNodeId(content, nodeId);
  }
};

const attachNodeIdsByPaths = (node: MarkdownReadNode, entries: MarkdownNodeIdEntry[]): void => {
  for (const entry of entries) {
    let target: MarkdownReadNode | undefined = node;
    for (const index of entry.path) {
      const children = target && 'children' in target ? target.children : undefined;
      if (!Array.isArray(children)) {
        target = undefined;
        break;
      }
      target = children[index] as MarkdownReadNode | undefined;
    }
    if (target) attachNodeId(target, entry.nodeId);
  }
};

const isRecordNode = (value: unknown): value is MarkdownReadNode =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const consumeNodeIdMarkers = (
  nodes: Array<MarkdownReadNode | MarkdownNodeIdMarker>,
  options: { bindTrailingNodeMarker?: boolean } = {},
): MarkdownReadNode[] => {
  const result: MarkdownReadNode[] = [];
  const pendingMarkers: MarkdownNodeIdMarker[] = [];
  for (const node of nodes) {
    if (isNodeIdMarker(node)) {
      pendingMarkers.push(node);
      continue;
    }
    if (pendingMarkers.length > 0) {
      for (const marker of pendingMarkers) {
        if (marker.kind === 'tree') {
          if (marker.entries) attachNodeIdsByPaths(node, marker.entries);
        } else if (marker.nodeId) {
          attachNodeId(node, marker.nodeId);
        }
      }
      pendingMarkers.length = 0;
    }
    result.push(node);
  }

  // Remark keeps a comment-only tail as an HTML node, so a marker emitted for
  // Lexical's automatic trailing empty paragraph has no following block to
  // consume it. Bind exactly one well-formed node marker to a synthetic empty
  // paragraph at the root. Tree markers (and ambiguous multiple markers) are
  // deliberately dropped: there is no safe structural target at EOF for
  // their path entries.
  if (
    options.bindTrailingNodeMarker &&
    pendingMarkers.length === 1 &&
    pendingMarkers[0].kind === 'node' &&
    pendingMarkers[0].nodeId
  ) {
    const paragraph = INodeHelper.createParagraph();
    attachNodeId(paragraph, pendingMarkers[0].nodeId);
    result.push(paragraph);
  }
  return result;
};

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
          const isComment = child.value.startsWith('<!--') && child.value.endsWith('-->');
          if (isComment) {
            const marker = parseNodeIdMarker(child.value) ?? parseNodeIdsMarker(child.value);
            if (marker) {
              append(marker as unknown as MarkdownReadNode);
              return;
            }
            // Malformed private transport metadata must not become visible text.
            if (/^\s*<!--\s*lobe-node-ids?:/i.test(child.value)) return;
          }
          if (!markdownReaders.html) {
            append(INodeHelper.createTextNode(child.value));
            return;
          }
          if (isComment) return;

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
          if (/\/\s*>$/.test(child.value.trim())) {
            append(readHtml(child, [], index) ?? INodeHelper.createTextNode(child.value));
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
        children = consumeNodeIdMarkers(result, {
          bindTrailingNodeMarker: node.type === 'root',
        });
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
