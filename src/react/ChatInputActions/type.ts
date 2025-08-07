import type { ActionIconProps, MenuInfo, MenuItemType } from '@lobehub/ui';
import type { ReactNode } from 'react';
import type { FlexboxProps } from 'react-layout-kit';

export type ChatInputActionEvent = Pick<MenuInfo, 'key' | 'keyPath' | 'domEvent'>;

export type ActionItem = MenuItemType & {
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

export type ChatInputActionItem = ActionItem | DividerItem | CollapseItem;

export interface ChatInputActionsProps extends Omit<FlexboxProps, 'children'> {
  actionIconProps?: Partial<Omit<ActionIconProps, 'icon' | 'ref'>>;
  disabled?: boolean;
  items?: ChatInputActionItem[];
  onActionClick?: (action: ChatInputActionEvent) => void;
}

export interface ChatInputActionsCollapseProps {
  actionIconProps?: Partial<Omit<ActionIconProps, 'icon' | 'ref'>>;
  children?: ReactNode;
  defaultExpand?: boolean;
  expand?: boolean;
  gap?: FlexboxProps['gap'];
  onChange?: (expand: boolean) => void;
}
