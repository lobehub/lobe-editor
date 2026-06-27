/* eslint-disable no-redeclare */
/* eslint-disable @typescript-eslint/no-redeclare */
import { $isHeadingNode } from '@lexical/rich-text';
import EventEmitter from 'eventemitter3';
import {
  $getRoot,
  $isElementNode,
  type ElementNode,
  type LexicalEditor,
  type LexicalNode,
} from 'lexical';

import { genServiceId } from '@/editor-kernel';
import type { IServiceID } from '@/types';

import type { TocHeadingTag, TocItem, TocJumpOptions, TocPluginOptions } from '../types';
import { buildTocTree, flattenTocTree } from '../utils';

export interface ITocService {
  getActiveKey(): null | string;
  getFlatItems(): TocItem[];
  getItems(): TocItem[];
  jumpTo(key: string, options?: TocJumpOptions): boolean;
  refresh(): TocItem[];
  setActiveKey(key: null | string): void;
  setDepthRange(options: TocPluginOptions): void;
  subscribe(listener: () => void): () => void;
}

export type { TocHeadingTag, TocItem, TocJumpOptions, TocPluginOptions } from '../types';

export const ITocService: IServiceID<ITocService> = genServiceId<ITocService>('TocService');

type TocServiceEvents = {
  change: () => void;
};

function walkHeadings(
  node: LexicalNode,
  headings: Omit<TocItem, 'children'>[],
  minDepth: number,
  maxDepth: number,
) {
  if ($isHeadingNode(node)) {
    const tag = node.getTag() as TocHeadingTag;
    const depth = Number(tag.slice(1));
    const title = node.getTextContent().trim();

    if (title && depth >= minDepth && depth <= maxDepth) {
      headings.push({
        depth,
        key: node.getKey(),
        tag,
        title,
      });
    }
  }

  if ($isElementNode(node)) {
    for (const child of (node as ElementNode).getChildren()) {
      walkHeadings(child, headings, minDepth, maxDepth);
    }
  }
}

function isSameTocItems(a: TocItem[], b: TocItem[]): boolean {
  const flatA = flattenTocTree(a);
  const flatB = flattenTocTree(b);

  if (flatA.length !== flatB.length) return false;

  return flatA.every((item, index) => {
    const next = flatB[index];
    return (
      item.key === next.key &&
      item.depth === next.depth &&
      item.tag === next.tag &&
      item.title === next.title
    );
  });
}

export class TocService extends EventEmitter<TocServiceEvents> implements ITocService {
  private activeKey: null | string = null;
  private editor: LexicalEditor | null = null;
  private items: TocItem[] = [];
  private maxDepth = 6;
  private minDepth = 1;

  bindEditor(editor: LexicalEditor): void {
    this.editor = editor;
  }

  getActiveKey(): null | string {
    return this.activeKey;
  }

  getFlatItems(): TocItem[] {
    return flattenTocTree(this.items);
  }

  getItems(): TocItem[] {
    return this.items;
  }

  jumpTo(key: string, options?: TocJumpOptions): boolean {
    const element = this.editor?.getElementByKey(key);
    if (!element) return false;

    const behavior = options?.behavior ?? 'smooth';
    const offsetTop = options?.offsetTop ?? 0;
    const scrollContainer = options?.container;

    if (typeof window === 'undefined') {
      element.scrollIntoView({
        behavior,
        block: options?.block ?? 'start',
      });
      this.setActiveKey(key);

      return true;
    }

    if (!scrollContainer || scrollContainer instanceof Window) {
      const top = element.getBoundingClientRect().top + window.scrollY - offsetTop;
      window.scrollTo({ behavior, top });
    } else {
      const containerTop = scrollContainer.getBoundingClientRect().top;
      const top =
        scrollContainer.scrollTop + element.getBoundingClientRect().top - containerTop - offsetTop;
      scrollContainer.scrollTo({ behavior, top });
    }

    this.setActiveKey(key);

    return true;
  }

  refresh(): TocItem[] {
    if (!this.editor) {
      this.updateItems([]);
      return [];
    }

    const items = this.editor.getEditorState().read(() => {
      const headings: Omit<TocItem, 'children'>[] = [];
      walkHeadings($getRoot(), headings, this.minDepth, this.maxDepth);
      return buildTocTree(headings);
    });

    this.updateItems(items);

    return items;
  }

  setActiveKey(key: null | string): void {
    if (this.activeKey === key) return;

    this.activeKey = key;
    this.emit('change');
  }

  setDepthRange(options: TocPluginOptions): void {
    const minDepth = options.minDepth ?? 1;
    const maxDepth = options.maxDepth ?? 6;

    if (this.minDepth === minDepth && this.maxDepth === maxDepth) return;

    this.minDepth = minDepth;
    this.maxDepth = maxDepth;
    this.refresh();
  }

  subscribe(listener: () => void): () => void {
    this.on('change', listener);

    return () => {
      this.off('change', listener);
    };
  }

  private updateItems(items: TocItem[]): void {
    if (isSameTocItems(this.items, items)) return;

    this.items = items;
    const flatItems = this.getFlatItems();
    if (this.activeKey && !flatItems.some((item) => item.key === this.activeKey)) {
      this.activeKey = flatItems[0]?.key ?? null;
    }
    this.emit('change');
  }
}
