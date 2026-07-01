/* eslint-disable no-redeclare */
/* eslint-disable @typescript-eslint/no-redeclare */
import EventEmitter from 'eventemitter3';
import type { LexicalEditor } from 'lexical';

import { genServiceId } from '@/editor-kernel';
import { IServiceID } from '@/types';

import type { LinkNode } from '../node/LinkNode';

export type LinkToolbarItemIcon = 'copy' | 'edit' | 'open' | 'unlink';

export interface LinkToolbarRenderContext {
  close: () => void;
  editor: LexicalEditor;
  linkDom: HTMLElement | null;
  linkNode: LinkNode;
}

export interface LinkToolbarItem {
  icon: LinkToolbarItemIcon;
  key: string;
  label: string | ((context: LinkToolbarRenderContext) => string);
  onClick: (context: LinkToolbarRenderContext) => void | Promise<void>;
  order?: number;
  when?: (context: LinkToolbarRenderContext) => boolean;
}

export interface ILinkService {
  readonly enableLinkToolbar: boolean;
  getToolbarItems(context: LinkToolbarRenderContext): LinkToolbarItem[];
  registerToolbarItem(item: LinkToolbarItem): () => void;
  setLinkToolbar(enable: boolean): void;
  subscribe(listener: () => void): () => void;
}

export const ILinkService: IServiceID<ILinkService> = genServiceId<ILinkService>('LinkService');

export class LinkService
  extends EventEmitter<'change' | 'linkToolbarChange'>
  implements ILinkService
{
  private _enableLinkToolbar: boolean = true;
  private toolbarItems: Map<string, LinkToolbarItem> = new Map();

  public get enableLinkToolbar(): boolean {
    return this._enableLinkToolbar;
  }

  getToolbarItems(context: LinkToolbarRenderContext): LinkToolbarItem[] {
    return Array.from(this.toolbarItems.values())
      .filter((item) => (item.when ? item.when(context) : true))
      .sort((a, b) => (a.order || 0) - (b.order || 0));
  }

  registerToolbarItem(item: LinkToolbarItem): () => void {
    this.toolbarItems.set(item.key, item);
    this.emit('change');

    return () => {
      this.toolbarItems.delete(item.key);
      this.emit('change');
    };
  }

  setLinkToolbar(enable: boolean): void {
    this._enableLinkToolbar = enable;
    this.emit('linkToolbarChange', enable);
  }

  subscribe(listener: () => void): () => void {
    this.on('change', listener);

    return () => {
      this.off('change', listener);
    };
  }
}
