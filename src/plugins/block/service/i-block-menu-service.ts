import type { ReactNode } from 'react';

import { genServiceId } from '@/editor-kernel';
import type { IEditor, IServiceID } from '@/types';

export interface IBlockMenuRenderContext {
  blockElement: HTMLElement;
  blockId: string;
  editor: IEditor;
}

export interface IBlockMenuItem {
  key: string;
  order?: number;
  render: (context: IBlockMenuRenderContext) => ReactNode;
  when?: (context: IBlockMenuRenderContext) => boolean;
}

export interface IBlockMenuService {
  getMenus(context: IBlockMenuRenderContext): IBlockMenuItem[];
  registerMenu(item: IBlockMenuItem): () => void;
  subscribe(listener: () => void): () => void;
}

// eslint-disable-next-line @typescript-eslint/no-redeclare, no-redeclare
export const IBlockMenuService: IServiceID<IBlockMenuService> =
  genServiceId<IBlockMenuService>('BlockMenuService');

export class BlockMenuService implements IBlockMenuService {
  private items: Map<string, IBlockMenuItem> = new Map();
  private listeners: Set<() => void> = new Set();

  getMenus(context: IBlockMenuRenderContext): IBlockMenuItem[] {
    return Array.from(this.items.values())
      .filter((item) => (item.when ? item.when(context) : true))
      .sort((a, b) => (a.order || 0) - (b.order || 0));
  }

  registerMenu(item: IBlockMenuItem): () => void {
    this.items.set(item.key, item);
    this.notify();

    return () => {
      this.items.delete(item.key);
      this.notify();
    };
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);

    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify(): void {
    for (const listener of this.listeners) {
      listener();
    }
  }
}
