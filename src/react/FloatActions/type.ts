import type { MenuInfo, MenuItemType, TooltipProps } from '@lobehub/ui';
import type { ReactNode } from 'react';
import type { FlexboxProps } from 'react-layout-kit';

export type FloatActionsEvent = Pick<MenuInfo, 'key' | 'keyPath' | 'domEvent'>;

export interface ActionItem extends MenuItemType {
  active?: boolean;
  children?: ReactNode;
  tooltipProps?: TooltipProps;
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

export type FloatActionsItem = ActionItem | DividerItem | CollapseItem | DropdownItem;

export interface FloatActionsProps extends Omit<FlexboxProps, 'children'> {
  defaultGroupCollapse?: boolean;
  disabled?: boolean;
  groupCollapse?: boolean;
  items?: FloatActionsItem[];
  onActionClick?: (action: FloatActionsEvent) => void;
  onGroupCollapseChange?: (collapse: boolean) => void;
}

export interface FloatActionsCollapseProps {
  children?: ReactNode;
  collapse?: boolean;
  gap?: FlexboxProps['gap'];
  groupCollapse?: boolean;
  mode?: 'default' | 'popup';
  onGroupCollapseChange?: (collapse: boolean) => void;
}
