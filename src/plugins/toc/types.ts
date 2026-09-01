export type TocHeadingTag = 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6';

export interface TocItem {
  children: TocItem[];
  depth: number;
  key: string;
  tag: TocHeadingTag;
  title: string;
}

export interface TocPluginOptions {
  maxDepth?: number;
  minDepth?: number;
}

export type TocScrollBehavior = 'auto' | 'instant' | 'smooth';

export type TocScrollLogicalPosition = 'center' | 'end' | 'nearest' | 'start';

export interface TocJumpOptions {
  behavior?: TocScrollBehavior;
  block?: TocScrollLogicalPosition;
  container?: HTMLElement | Window | null;
  offsetTop?: number;
}
