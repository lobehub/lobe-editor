import type { LexicalNode } from 'lexical';

import { genServiceId } from '@/editor-kernel';
import type { IEditor, IServiceID } from '@/types';

export interface IBlockMenuRenderContext {
  blockElement: HTMLElement;
  blockId: string;
  editor: IEditor;
}

export interface IBlockMenuItem {
  key: string;
  label: string | ((context: IBlockMenuRenderContext) => string);
  onClick: (context: IBlockMenuRenderContext) => void;
  order?: number;
  when?: (context: IBlockMenuRenderContext) => boolean;
}

export type IBlockActionButtonIcon = 'plus';

export interface IBlockActionButton {
  icon?: IBlockActionButtonIcon;
  key: string;
  onClick: (context: IBlockMenuRenderContext) => void;
  order?: number;
  title: string | ((context: IBlockMenuRenderContext) => string);
  when?: (context: IBlockMenuRenderContext) => boolean;
}

export interface IBlockSelectHandler {
  key: string;
  onSelect: (node: LexicalNode) => boolean | void;
  order?: number;
}

export interface IBlockMenuService {
  getActionButtons(context: IBlockMenuRenderContext): IBlockActionButton[];
  getMenus(context: IBlockMenuRenderContext): IBlockMenuItem[];
  isMenuSuppressed(): boolean;
  registerActionButton(item: IBlockActionButton): () => void;
  registerMenu(item: IBlockMenuItem): () => void;
  registerSelectHandler(item: IBlockSelectHandler): () => void;
  selectNode(node: LexicalNode): boolean;
  setMenuSuppressed(key: string, suppressed: boolean): void;
  subscribe(listener: () => void): () => void;
}

// eslint-disable-next-line @typescript-eslint/no-redeclare, no-redeclare
export const IBlockMenuService: IServiceID<IBlockMenuService> =
  genServiceId<IBlockMenuService>('BlockMenuService');

export class BlockMenuService implements IBlockMenuService {
  private actionButtons: Map<string, IBlockActionButton> = new Map();
  private items: Map<string, IBlockMenuItem> = new Map();
  private listeners: Set<() => void> = new Set();
  private selectHandlers: Map<string, IBlockSelectHandler> = new Map();
  private suppressors: Set<string> = new Set();

  getActionButtons(context: IBlockMenuRenderContext): IBlockActionButton[] {
    return Array.from(this.actionButtons.values())
      .filter((item) => (item.when ? item.when(context) : true))
      .sort((a, b) => (a.order || 0) - (b.order || 0));
  }

  getMenus(context: IBlockMenuRenderContext): IBlockMenuItem[] {
    return Array.from(this.items.values())
      .filter((item) => (item.when ? item.when(context) : true))
      .sort((a, b) => (a.order || 0) - (b.order || 0));
  }

  isMenuSuppressed(): boolean {
    return this.suppressors.size > 0;
  }

  registerActionButton(item: IBlockActionButton): () => void {
    this.actionButtons.set(item.key, item);
    this.notify();

    return () => {
      this.actionButtons.delete(item.key);
      this.notify();
    };
  }

  registerMenu(item: IBlockMenuItem): () => void {
    this.items.set(item.key, item);
    this.notify();

    return () => {
      this.items.delete(item.key);
      this.notify();
    };
  }

  registerSelectHandler(item: IBlockSelectHandler): () => void {
    this.selectHandlers.set(item.key, item);
    this.notify();

    return () => {
      this.selectHandlers.delete(item.key);
      this.notify();
    };
  }

  selectNode(node: LexicalNode): boolean {
    const handlers = Array.from(this.selectHandlers.values()).sort(
      (a, b) => (a.order || 0) - (b.order || 0),
    );

    for (const handler of handlers) {
      if (handler.onSelect(node)) {
        return true;
      }
    }

    return false;
  }

  setMenuSuppressed(key: string, suppressed: boolean): void {
    const size = this.suppressors.size;

    if (suppressed) {
      this.suppressors.add(key);
    } else {
      this.suppressors.delete(key);
    }

    if (this.suppressors.size !== size) {
      this.notify();
    }
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
