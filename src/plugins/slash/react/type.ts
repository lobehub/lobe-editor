import type { FC, ReactElement } from 'react';

import type { SlashOptions } from '@/plugins/slash';
import type { ISlashMenuOption, ISlashOption } from '@/plugins/slash/service/i-slash-service';
import type { IEditor } from '@/types';

export interface ReactSlashOptionProps {
  /**
   * Searchable options
   */
  items?: SlashOptions['items'];
  /**
   * Maximum search length
   * Default is 75
   */
  maxLength?: number;
  onSelect?: (editor: IEditor, option: ISlashMenuOption) => void;
  /**
   * Custom render component
   */
  renderComp?: FC<MenuRenderProps>;
  /**
   * Trigger character
   */
  trigger?: SlashOptions['trigger'];
}

export interface MenuRenderProps {
  /**
   * Current active option key
   */
  activeKey: string | null;
  /**
   * Loading state
   */
  loading?: boolean;
  /**
   * Actively trigger selection
   * @param option Currently selected element
   */
  onSelect?: (option: ISlashMenuOption) => void;
  open?: boolean;
  /**
   * Currently searched options
   */
  options: Array<ISlashOption>;
  /**
   * Actively set current active option key
   * @param key
   * @returns
   */
  setActiveKey: (key: string | null) => void;
}

export interface ReactSlashPluginProps {
  anchorClassName?: string;
  children?:
    | (ReactElement<ReactSlashOptionProps> | undefined)
    | (ReactElement<ReactSlashOptionProps> | undefined)[];
}
