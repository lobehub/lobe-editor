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
  /**
   * Returns the currently pinned menu context, or null when no lock is active.
   * While locked, the block menu UI freezes at the pinned block and hover
   * detection no longer reassigns the anchor.
   */
  getMenuLockedContext(): IBlockMenuRenderContext | null;
  getMenus(context: IBlockMenuRenderContext): IBlockMenuItem[];
  isMenuSuppressed(): boolean;
  registerActionButton(item: IBlockActionButton): () => void;
  registerMenu(item: IBlockMenuItem): () => void;
  registerSelectHandler(item: IBlockSelectHandler): () => void;
  selectNode(node: LexicalNode): boolean;
  /**
   * Pin the block menu UI to the provided context (typically while a consumer
   * popup spawned by an action button is open). Pass `null` for `context` to
   * release the lock owned by `key`. Multiple keys may hold locks
   * simultaneously; the most recently set lock wins.
   */
  setMenuLockedContext(key: string, context: IBlockMenuRenderContext | null): void;
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
  private lockedContexts: Map<string, IBlockMenuRenderContext> = new Map();
  private selectHandlers: Map<string, IBlockSelectHandler> = new Map();
  private suppressors: Set<string> = new Set();

  getActionButtons(context: IBlockMenuRenderContext): IBlockActionButton[] {
    return Array.from(this.actionButtons.values())
      .filter((item) => (item.when ? item.when(context) : true))
      .sort((a, b) => (a.order || 0) - (b.order || 0));
  }

  getMenuLockedContext(): IBlockMenuRenderContext | null {
    if (this.lockedContexts.size === 0) return null;
    let last: IBlockMenuRenderContext | null = null;
    for (const ctx of this.lockedContexts.values()) {
      last = ctx;
    }
    return last;
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

  setMenuLockedContext(key: string, context: IBlockMenuRenderContext | null): void {
    const existing = this.lockedContexts.get(key);

    if (context === null) {
      if (!this.lockedContexts.delete(key)) return;
      this.notify();
      return;
    }

    if (existing === context) return;

    this.lockedContexts.delete(key);
    this.lockedContexts.set(key, context);
    this.notify();
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
