/* eslint-disable no-redeclare */
/* eslint-disable @typescript-eslint/no-redeclare */
import { DropdownMenuItemType } from '@lobehub/ui';
import Fuse from 'fuse.js';

import { genServiceId } from '@/editor-kernel';
import type { IEditor, IEditorKernel, IServiceID } from '@/types';
import { createDebugLogger } from '@/utils/debug';

import { getBasicTypeaheadTriggerMatch } from '../utils/utils';

export type ISlashDividerOption = {
  type: 'divider';
};

export interface ISlashMenuOption extends Omit<DropdownMenuItemType, 'extra'> {
  metadata?: Record<string, any>;
  onSelect?: (editor: IEditor, matchingString: string) => void;
}

export type ISlashOption = ISlashMenuOption | ISlashDividerOption;

export interface SlashOptions {
  allowWhitespace?: boolean;
  // Trigger symbol
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
  private logger = createDebugLogger('service', 'slash');

  constructor(private kernel: IEditorKernel) {}
  // Specific service methods can be added here

  registerSlash(options: SlashOptions): void {
    if (this.triggerMap.has(options.trigger)) {
      if (this.kernel.isHotReloadMode()) {
        this.logger.warn(`🔄 Overriding slash trigger "${options.trigger}"`);
      } else {
        throw new Error(`Slash trigger "${options.trigger}" is already registered.`);
      }
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
    this.logger.debug(`⚡ Slash trigger: ${options.trigger}`);

    if (Array.isArray(options.items)) {
      // Filter out divider items for search functionality
      const searchableItems = options.items.filter(
        (item): item is ISlashMenuOption => !('type' in item) || item.type !== 'divider',
      );
      this.triggerFuseMap.set(
        options.trigger,
        new Fuse(searchableItems, {
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
