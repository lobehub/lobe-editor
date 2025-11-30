/* eslint-disable no-redeclare */
/* eslint-disable @typescript-eslint/no-redeclare */
import EventEmitter from 'eventemitter3';

import { genServiceId } from '@/editor-kernel';
import { IServiceID } from '@/types';

export interface ILinkService {
  setLinkToolbar(enable: boolean): void;
}

export const ILinkService: IServiceID<ILinkService> = genServiceId<ILinkService>('LinkService');

export class LinkService extends EventEmitter<'linkToolbarChange'> implements ILinkService {
  private _enableLinkToolbar: boolean = true;

  public get enableLinkToolbar(): boolean {
    return this._enableLinkToolbar;
  }

  setLinkToolbar(enable: boolean): void {
    this._enableLinkToolbar = enable;
    this.emit('linkToolbarChange', enable);
  }
}
