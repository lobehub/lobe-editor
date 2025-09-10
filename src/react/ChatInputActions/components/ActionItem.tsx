'use client';

import { ActionIcon, Dropdown } from '@lobehub/ui';
import { memo } from 'react';

import type { ChatInputActionItem, ChatInputActionsProps } from '../type';
import ActionRender from './ActionRender';
import CollapsedActions from './CollapsedActions';

interface ChatInputActionItemProps {
  collapsed?: boolean;
  disabled?: boolean;
  gap?: string | number;
  groupCollapsed?: boolean;
  item: ChatInputActionItem;
  onActionClick: ChatInputActionsProps['onActionClick'];
  setGroupCollapsed?: (collapse: boolean) => void;
}

const ActionItem = memo<ChatInputActionItemProps>(
  ({ item, disabled, onActionClick, groupCollapsed, collapsed, gap, setGroupCollapsed }) => {
    if (item.type === 'collapse') {
      return (
        <CollapsedActions
          gap={gap}
          groupCollapse={groupCollapsed}
          mode={collapsed ? 'popup' : 'default'}
          onGroupCollapseChange={setGroupCollapsed}
        >
          {item.children.map((child, childIndex) => (
            <ActionRender
              disabled={disabled}
              item={child}
              key={(child as any)?.key || `action-${childIndex}`}
              onActionClick={onActionClick}
            />
          ))}
        </CollapsedActions>
      );
    }

    if (item.type === 'dropdown') {
      return (
        <Dropdown
          key={item.key}
          menu={{
            items: item.children,
          }}
        >
          <ActionIcon
            active={item.active}
            danger={item.danger}
            disabled={disabled || item.loading || item?.disabled}
            icon={item.icon}
            loading={item.loading}
            size={{
              blockSize: 36,
              size: 20,
            }}
            title={item.label}
            tooltipProps={{
              placement: 'top',
              ...item.tooltipProps,
            }}
          />
        </Dropdown>
      );
    }

    return <ActionRender disabled={disabled} item={item} onActionClick={onActionClick} />;
  },
);

ActionItem.displayName = 'ChatInputActionItem';

export default ActionItem;
