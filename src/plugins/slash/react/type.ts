import type { FC, ReactElement } from 'react';

import { SlashOptions } from '@/plugins/slash';
import { ISlashOption } from '@/plugins/slash/service/i-slash-service';

export interface ReactSlashOptionProps {
  /**
   * 是否禁用浮动
   */
  disableFloating?: boolean;
  /**
   * 可以搜索的选项
   */
  items?: SlashOptions['items'];
  /**
   * 搜索的最大长度
   * 默认为 75
   */
  maxLength?: number;
  /**
   * 自定义渲染组件
   */
  renderComp?: FC<MenuRenderProps>;
  /**
   * 触发字符
   */
  trigger?: SlashOptions['trigger'];
}

export interface MenuRenderProps {
  /**
   * 当前激活的选项 key
   */
  activeKey: string | null;
  /**
   * 加载状态
   */
  loading?: boolean;
  open?: boolean;
  /**
   * 当前搜索到的选项
   */
  options: Array<ISlashOption>;
  /**
   * 主动触发选中
   * @param option 当前选中元素
   */
  selectOptionAndCleanUp: (option: ISlashOption) => void;
  /**
   * 主动设置当前激活的选项 key
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
