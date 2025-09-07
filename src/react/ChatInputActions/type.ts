import type { MenuInfo, MenuItemType } from '@lobehub/ui';
import type { ReactNode } from 'react';
import type { FlexboxProps } from 'react-layout-kit';

export type ChatInputActionEvent = Pick<MenuInfo, 'key' | 'keyPath' | 'domEvent'>;

export interface ActionItem extends MenuItemType {
  active?: boolean;
  alwaysDisplay?: boolean;
  children?: ReactNode;
  wrapper?: (dom: ReactNode) => ReactNode;
}

export type DividerItem = {
  type: 'divider';
};

export type CollapseItem = {
  children: (ActionItem | DividerItem)[];
  type: 'collapse';
};

export type DropdownItem = Omit<ActionItem, 'children' | 'type'> & {
  children: MenuItemType[];
  type: 'dropdown';
};

export type ChatInputActionItem = ActionItem | DividerItem | CollapseItem | DropdownItem;

export interface ChatInputActionsProps extends Omit<FlexboxProps, 'children'> {
  autoCollapse?: boolean;
  collapseOffset?: number;
  defaultGroupCollapse?: boolean;
  disabled?: boolean;
  groupCollapse?: boolean;
  items?: ChatInputActionItem[];
  onActionClick?: (action: ChatInputActionEvent) => void;
  onGroupCollapseChange?: (collapse: boolean) => void;
}

export interface ChatInputActionsCollapseProps {
  children?: ReactNode;
  collapse?: boolean;
  gap?: FlexboxProps['gap'];
  groupCollapse?: boolean;
  mode?: 'default' | 'popup';
  onGroupCollapseChange?: (collapse: boolean) => void;
}
