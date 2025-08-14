import type { MenuInfo, MenuItemType } from '@lobehub/ui';
import type { ReactNode } from 'react';
import type { FlexboxProps } from 'react-layout-kit';

export type ChatInputActionEvent = Pick<MenuInfo, 'key' | 'keyPath' | 'domEvent'>;

export type ActionItem = MenuItemType & {
  active?: boolean;
  alwaysDisplay?: boolean;
  children?: ReactNode;
  wrapper?: (dom: ReactNode, key: string) => ReactNode;
};

export type DividerItem = {
  type: 'divider';
};

export type CollapseItem = {
  children: (ActionItem | DividerItem)[];
  defaultExpand?: boolean;
  expand?: boolean;
  onChange?: (expand: boolean) => void;
  type: 'collapse';
};

export type DropdownItem = Omit<ActionItem, 'children' | 'type'> & {
  children: MenuItemType[];
  type: 'dropdown';
};

export type ChatInputActionItem = ActionItem | DividerItem | CollapseItem | DropdownItem;

export interface ChatInputActionsProps extends Omit<FlexboxProps, 'children'> {
  disabled?: boolean;
  items?: ChatInputActionItem[];
  onActionClick?: (action: ChatInputActionEvent) => void;
}

export interface ChatInputActionsCollapseProps {
  children?: ReactNode;
  defaultExpand?: boolean;
  expand?: boolean;
  gap?: FlexboxProps['gap'];
  mode?: 'default' | 'popup';
  onChange?: (expand: boolean) => void;
}
