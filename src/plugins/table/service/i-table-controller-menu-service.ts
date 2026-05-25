import type { TableNode } from '@lexical/table';
import type { LexicalEditor } from 'lexical';

import { genServiceId } from '@/editor-kernel';
import type { IServiceID } from '@/types';

export type TableControllerMenuAxis = 'column' | 'row';

export interface ITableControllerMenuRenderContext {
  axis: TableControllerMenuAxis;
  editor: LexicalEditor;
  node: TableNode;
  selectedIndexes: number[];
}

interface ITableControllerBaseMenuItem {
  key: string;
  order?: number;
  when?: (context: ITableControllerMenuRenderContext) => boolean;
}

export interface ITableControllerMenuActionItem extends ITableControllerBaseMenuItem {
  danger?: boolean;
  label: string | ((context: ITableControllerMenuRenderContext) => string);
  onClick: (context: ITableControllerMenuRenderContext) => void;
  preview?: 'delete';
  type?: 'item';
}

export interface ITableControllerMenuSeparatorItem extends ITableControllerBaseMenuItem {
  type: 'separator';
}

export type ITableControllerMenuItem =
  | ITableControllerMenuActionItem
  | ITableControllerMenuSeparatorItem;

export interface ITableControllerMenuService {
  getItems(context: ITableControllerMenuRenderContext): ITableControllerMenuItem[];
  registerItem(item: ITableControllerMenuItem): () => void;
  subscribe(listener: () => void): () => void;
}

// eslint-disable-next-line @typescript-eslint/no-redeclare, no-redeclare
export const ITableControllerMenuService: IServiceID<ITableControllerMenuService> =
  genServiceId<ITableControllerMenuService>('TableControllerMenuService');

export class TableControllerMenuService implements ITableControllerMenuService {
  private items: Map<string, ITableControllerMenuItem> = new Map();
  private listeners: Set<() => void> = new Set();

  getItems(context: ITableControllerMenuRenderContext): ITableControllerMenuItem[] {
    return Array.from(this.items.values())
      .filter((item) => (item.when ? item.when(context) : true))
      .sort((a, b) => (a.order || 0) - (b.order || 0));
  }

  registerItem(item: ITableControllerMenuItem): () => void {
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
