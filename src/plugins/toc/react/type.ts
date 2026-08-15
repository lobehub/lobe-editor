import type { IEditor } from '@/types';

import type { ITocService } from '../service';
import type { TocItem, TocScrollBehavior } from '../types';
import type { GetTocScrollContainer } from './getNearestScrollContainer';

export type { TocHeadingTag, TocItem } from '../types';

export interface ReactTocPluginProps {
  editor?: IEditor;
  maxDepth?: number;
  minDepth?: number;
}

export interface UseTocOptions {
  /** @default 'smooth' */
  behavior?: TocScrollBehavior;
  editor: IEditor;
  getScrollContainer?: GetTocScrollContainer;
  maxDepth?: number;
  minDepth?: number;
  offsetTop?: number;
  onItemsChange?: (items: TocItem[]) => void;
}

export interface UseTocResult {
  activeKey: null | string;
  items: TocItem[];
  jumpTo: (key: string) => void;
  service: ITocService | null;
}
