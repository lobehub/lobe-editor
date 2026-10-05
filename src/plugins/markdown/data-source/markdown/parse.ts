import type { Heading, Html, Paragraph, PhrasingContent, Root, RootContent, Text } from 'mdast';
import { remark } from 'remark';
import remarkCjkFriendly from 'remark-cjk-friendly';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';

import type { IElementNode, INode, IRootNode, ITextNode } from '@/editor-kernel/inode';
import { INodeHelper } from '@/editor-kernel/inode/helper';

import { logger } from '../../utils/logger';

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

const selfClosingHtmlTags = new Set([
  'area',
  'base',
  'br',
  'col',
  'embed',
  'hr',
  'img',
  'input',
  'link',
  'meta',
  'param',
  'source',
  'track',
  'wbr',
]);

class MarkdownContext {
  private stack: Array<IHTMLStack> = [];
  constructor(
    public readonly root: Root,
    public readonly markdown: string,
  ) {}

  push(html: IHTMLStack) {
    this.stack.push(html);
  }

  get isReadingHTML() {
    return this.stack.length > 0;
  }

  get last() {
    return this.stack.at(-1);
  }

  pop() {
    return this.stack.pop();
  }
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
        children = node.children
          .reduce(
            (ret, child, index) => {
              if (child.type === 'html') {
                const isComment = child.value.startsWith('<!--') && child.value.endsWith('-->');
                const marker = isComment
                  ? (parseNodeIdMarker(child.value) ?? parseNodeIdsMarker(child.value))
                  : null;
                if (marker) {
                  ret.push(marker as unknown as MarkdownReadNode);
                  return ret;
                }
                // A malformed transport marker is still private metadata;
                // never turn it into visible paragraph/cell text.
                if (isComment && /^\s*<!--\s*lobe-node-ids?:/i.test(child.value)) {
                  return ret;
                }
                if (!markdownReaders['html']) {
                  ret.push(INodeHelper.createTextNode(child.value));
                  return ret;
                }
                if (isComment) {
                  return ret;
                }
                const tag = getHtmlTagName(child.value);
                const isEndTag = child.value.startsWith('</');
                const pairedTag = child.value.match(
                  /^<\s*([a-z0-9-]+)\b[^>]*>([\s\S]*)<\/\s*\1\s*>$/i,
                );
                if (!isEndTag && pairedTag) {
                  const reader = markdownReaders['html'];
                  const htmlChildren = pairedTag[2]
                    ? [INodeHelper.createTextNode(pairedTag[2])]
                    : [];
                  if (Array.isArray(reader)) {
                    for (const element of reader) {
                      const inode = element(child as unknown as any, htmlChildren, index);
                      if (inode) {
                        ret.push(inode);
                        return ret;
                      }
                    }
                  } else if (typeof reader === 'function') {
                    const inode = reader(child as unknown as any, htmlChildren, index);
                    if (inode) {
                      ret.push(inode);
                      return ret;
                    }
                  }

                  ret.push(INodeHelper.createTextNode(child.value));
                  return ret;
                }
                if (selfClosingHtmlTags.has(tag)) {
                  // Self-closing tag
                  const reader = markdownReaders['html'];
                  if (Array.isArray(reader)) {
                    for (const element of reader) {
                      const inode = element(child as unknown as any, [], index);
                      if (inode) {
                        ret.push(inode);
                        return ret;
                      }
                    }
                  } else if (typeof reader === 'function') {
                    const inode = reader(child as unknown as any, [], index);
                    if (inode) {
                      ret.push(inode);
                      return ret;
                    }
                  }

                  return ret;
                }
                if (isEndTag) {
                  const top = ctx.pop();
                  htmlStack.pop();
                  if (top?.tag !== tag) {
                    logger.warn('HTML tag mismatch:', tag);
                    ret.push(...(top?.children || []));
                    return ret;
                  }
                  const reader = markdownReaders['html'];
                  const children = (top.children.flat().filter(Boolean) ||
                    []) as MarkdownReadNode[];
                  if (Array.isArray(reader)) {
                    for (const element of reader) {
                      const inode = element(top.node as unknown as any, children, index);
                      if (inode) {
                        ret.push(inode);
                        return ret;
                      }
                    }
                  } else if (typeof reader === 'function') {
                    const inode = reader(top.node as unknown as any, children, index);
                    if (inode) {
                      ret.push(inode);
                      return ret;
                    }
                  }
                  if (top) {
                    ret.push(...top.children);
                  }
                  return ret;
                }

                const htmlStackItem: IHTMLStack = {
                  children: [],
                  index,
                  isEndTag,
                  node: child,
                  tag,
                };

                htmlStack.push(htmlStackItem);
                ctx.push(htmlStackItem);
                return ret;
              }

              if (htmlStack.length > 0) {
                const top = ctx.last;
                if (top) {
                  top.children.push(
                    convertMdastToLexical(
                      child as PhrasingContent,
                      index,
                      ctx,
                      markdownReaders,
                      node.type,
                    ),
                  );
                }
                return ret;
              }

              ret.push(
                convertMdastToLexical(
                  child as PhrasingContent,
                  index,
                  ctx,
                  markdownReaders,
                  node.type,
                ),
              );
              return ret;
            },
            [] as (MarkdownReadNode | MarkdownReadNode[] | null)[],
          )
          .filter(Boolean)
          .flat() as MarkdownReadNode[];
        while (htmlStack.length > 0) {
          const tag = htmlStack.shift();
          ctx.pop();
          // @ts-expect-error not error
          children.push(INodeHelper.createTextNode(tag?.node.value), ...tag.children.flat());
          children = children.flat();
        }
      }

      // Comments are the only Markdown-safe transport for node identity. The
      // marker is consumed at the same AST level as the following block so
      // nested lists/quotes retain their IDs without exposing metadata in the
      // rendered document.
      children = consumeNodeIdMarkers(children, {
        bindTrailingNodeMarker: node.type === 'root',
      });

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

  const ctx = new MarkdownContext(ast, markdown);
  registerDefaultReaders(markdownReaders);

  return convertMdastToLexical(ast, 0, ctx, markdownReaders) as IRootNode;
}
