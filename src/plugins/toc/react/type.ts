import type { CSSProperties, ReactNode } from 'react';

import type { IEditor, ILocaleKeys } from '@/types';

import type { TocItem, TocScrollBehavior } from '../types';

export type { TocHeadingTag, TocItem } from '../types';

export interface TocRenderContext {
  activeKey: null | string;
  collapsed: boolean;
  items: TocItem[];
  jumpTo: (key: string) => void;
  pinned: boolean;
  setPinned: (pinned: boolean) => void;
}

export interface ReactTocPluginProps {
  /**
   * Scroll behavior used when clicking a toc item.
   * @default 'smooth'
   */
  behavior?: TocScrollBehavior;
  className?: string;
  defaultPinned?: boolean;
  editor?: IEditor;
  emptyText?: ReactNode;
  getScrollContainer?: (editor: IEditor) => HTMLElement | Window | null;
  locale?: Partial<Record<keyof ILocaleKeys, string>>;
  maxDepth?: number;
  minDepth?: number;
  /**
   * Top offset used for fixed TOC placement and heading jump alignment.
   * @default 8
   */
  offsetTop?: number;
  onItemsChange?: (items: TocItem[]) => void;
  onPinnedChange?: (pinned: boolean) => void;
  render?: (context: TocRenderContext) => ReactNode;
  /**
   * Extra spacing between editor content and the pinned TOC.
   * @default 24
   */
  reserveGap?: number;
  /**
   * Whether to reserve editor right-side space while the TOC is pinned.
   * @default true
   */
  reserveOnPinned?: boolean;
  showHeader?: boolean;
  style?: CSSProperties;
  title?: ReactNode;
}
