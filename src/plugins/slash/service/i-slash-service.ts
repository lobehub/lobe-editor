/* eslint-disable no-redeclare */
/* eslint-disable @typescript-eslint/no-redeclare */
import Fuse from 'fuse.js';

import { IEditor, type IEditorKernel, type IServiceID, genServiceId } from '@/editor-kernel';

import { getBasicTypeaheadTriggerMatch } from '../utils/utils';

export interface ISlashOption {
  icon?: string;
  label: string | unknown;
  onSelect?: (editor: IEditor, matchingString: string) => void;
  value: string;
}

export interface SlashOptions {
  allowWhitespace?: boolean;
  // 触发符号
  items:
    | Array<ISlashOption>
    | ((
        search: {
          leadOffset: number;
          matchingString: string;
          replaceableString: string;
        } | null,
      ) => Promise<Array<ISlashOption>>);
  maxLength?: number;
  minLength?: number;
  punctuation?: string;
  trigger: string;
}

export interface ISlashService {
  registerSlash(options: SlashOptions): void;
}

export const ISlashService: IServiceID<ISlashService> = genServiceId<ISlashService>('SlashService');

export class SlashService implements ISlashService {
  private triggerMap: Map<string, SlashOptions> = new Map();
  private triggerFnMap: Map<string, ReturnType<typeof getBasicTypeaheadTriggerMatch>> = new Map();
  private triggerFuseMap: Map<string, Fuse<ISlashOption>> = new Map();

  constructor(private kernel: IEditorKernel) {}
  // 这里可以添加具体的服务方法

  registerSlash(options: SlashOptions): void {
    if (this.triggerMap.has(options.trigger)) {
      throw new Error(`Slash trigger "${options.trigger}" is already registered.`);
    }
    this.triggerMap.set(options.trigger, options);
    this.triggerFnMap.set(
      options.trigger,
      getBasicTypeaheadTriggerMatch(options.trigger, {
        allowWhitespace: options.allowWhitespace,
        maxLength: options.maxLength,
        minLength: options.minLength,
        punctuation: options.punctuation,
      }),
    );

    if (Array.isArray(options.items)) {
      this.triggerFuseMap.set(
        options.trigger,
        new Fuse(options.items, {
          keys: ['label', 'value'],
        }),
      );
    }
  }

  getSlashOptions(trigger: string): SlashOptions | undefined {
    return this.triggerMap.get(trigger);
  }

  getSlashTriggerFn(trigger: string): ReturnType<typeof getBasicTypeaheadTriggerMatch> | undefined {
    return this.triggerFnMap.get(trigger);
  }

  getSlashFuse(trigger: string): Fuse<ISlashOption> | undefined {
    return this.triggerFuseMap.get(trigger);
  }
}
