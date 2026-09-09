import type { LexicalNode } from 'lexical';
import { $isElementNode } from 'lexical';

import { $isHoleNode } from '@/plugins/common/node/hole';
import { $getNodeId, $isNodeIdentityBlockTarget } from '@/plugins/properties/utils';

import type { IMarkdownWriterContext, MarkdownShortCutService } from '../service/shortcut';
import type { MarkdownNodeIdEntry } from './markdown/parse';

export interface MarkdownWriterOptions {
  /** Include private identity comments in the generated Markdown stream. */
  includeNodeIds?: boolean;
}

export class MarkdownWriterContext implements IMarkdownWriterContext {
  private before = '';
  private after = '';
  private children: Array<MarkdownWriterContext | string> = [];
  private markdownService: MarkdownShortCutService;
  private processor?: (before: string, content: string, after: string) => string;
  private readonly depth: number;
  private readonly includeNodeIds: boolean;

  constructor(
    markdownService?: MarkdownShortCutService,
    options: MarkdownWriterOptions = {},
    depth = 0,
  ) {
    this.markdownService = markdownService!;
    this.depth = depth;
    this.includeNodeIds = options.includeNodeIds === true;
  }

  appendLine(line: string): void {
    this.children.push(line);
  }

  newChild(): MarkdownWriterContext {
    const child = new MarkdownWriterContext(
      this.markdownService,
      { includeNodeIds: this.includeNodeIds },
      this.depth + 1,
    );
    this.children.push(child);
    return child;
  }

  wrap(before: string, after: string): void {
    this.before = before;
    this.after = after;
  }

  addProcessor(processor: (before: string, content: string, after: string) => string): void {
    this.processor = processor;
  }

  toString(): string {
    const content =
      this.before + this.children.map((child) => child.toString()).join('') + this.after;
    return this.processor
      ? this.processor(
          this.before,
          this.children.map((child) => child.toString()).join(''),
          this.after,
        )
      : content;
  }

  processChild(parentCtx: IMarkdownWriterContext, child: LexicalNode) {
    const writer = this.markdownService.markdownWriters[child.getType()];
    const parentContext = parentCtx as MarkdownWriterContext;
    // Only top-level comments are emitted. Descendant IDs travel in a compact
    // sidecar attached to that top-level block; comments inside list markers,
    // blockquotes, and table cells are not valid Markdown structure and can
    // otherwise become visible text or corrupt a table row.
    if (this.includeNodeIds && parentContext.depth === 0 && $isNodeIdentityBlockTarget(child)) {
      const nodeId = $getNodeId(child);
      if (nodeId) {
        parentCtx.appendLine(`<!-- lobe-node-id:${nodeId} -->\n`);
        const entries = collectNodeIdEntries(child);
        if (entries.length > 1) {
          parentCtx.appendLine(`<!-- lobe-node-ids:${encodeNodeIdEntries(entries)} -->\n`);
        }
      }
    }
    // A Hole is a runtime boundary around a logical Markdown node. Keep the
    // payload on the parent's context so the transparent Hole writer projects
    // its identity at the same depth as the serialized Markdown tree.
    let currentCtx = parentCtx as MarkdownWriterContext;
    if ($isElementNode(child) && !$isHoleNode(child)) {
      currentCtx = currentCtx.newChild();
    }
    let skipChildren: boolean | undefined = false;
    if (writer) {
      skipChildren = writer(currentCtx, child) as boolean | undefined;
    }
    if (skipChildren) {
      return;
    }
    if ($isElementNode(child)) {
      const children = $isHoleNode(child) ? child.getContentChildren() : child.getChildren();
      children.forEach((child) => this.processChild(currentCtx, child));
    }
  }
}

const collectNodeIdEntries = (root: LexicalNode): MarkdownNodeIdEntry[] => {
  const entries: MarkdownNodeIdEntry[] = [];
  const flattenHole = (node: LexicalNode): LexicalNode[] =>
    $isHoleNode(node) ? node.getContentChildren().flatMap(flattenHole) : [node];
  const getLogicalChildren = (node: LexicalNode): LexicalNode[] => {
    const children = $isHoleNode(node)
      ? node.getContentChildren()
      : $isElementNode(node)
        ? node.getChildren()
        : [];
    return children.flatMap(flattenHole);
  };

  const visit = (node: LexicalNode, path: number[]): void => {
    if ($isNodeIdentityBlockTarget(node)) {
      const nodeId = $getNodeId(node);
      if (nodeId) entries.push({ nodeId, path });
    }
    getLogicalChildren(node).forEach((child, index) => visit(child, [...path, index]));
  };
  visit(root, []);
  return entries;
};

const encodeNodeIdEntries = (entries: MarkdownNodeIdEntry[]): string =>
  encodeURIComponent(JSON.stringify(entries));
