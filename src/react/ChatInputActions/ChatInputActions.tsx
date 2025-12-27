'use client';

import { Flexbox, TooltipGroup } from '@lobehub/ui';
import { cx } from 'antd-style';
import { memo, useMemo } from 'react';
import useMergeState from 'use-merge-value';

import ActionItem from './components/ActionItem';
import { useDisplayActionCount } from './components/useDisplayActionCount';
import { styles } from './style';
import type { ChatInputActionsProps, CollapseItem } from './type';

// Keep memo: Complex calcItem computation and list rendering with state management
const ChatInputActions = memo<ChatInputActionsProps>(
  ({
    gap = 2,
    disabled,
    items = [],
    onActionClick,
    className,
    collapseOffset = 0,
    autoCollapse = true,
    defaultGroupCollapse = false,
    onGroupCollapseChange,
    groupCollapse,
    ...rest
  }) => {
    const [groupCollapsed, setGroupCollapsed] = useMergeState(defaultGroupCollapse, {
      defaultValue: defaultGroupCollapse,
      onChange: onGroupCollapseChange,
      value: groupCollapse,
    });

    const { ref, maxCount, collapsed } = useDisplayActionCount({
      autoCollapse,
      collapseOffset,
      items,
    });

    const calcItem = useMemo(() => {
      if (!collapsed) return items;
      const alwaysDisplayItems = items.filter((item: any) => item.alwaysDisplay);
      const normalItems = items.filter(
        (item: any) => item.type !== 'collapse' && !item.alwaysDisplay,
      );
      const collapseItems: CollapseItem = (items.find(
        (item) => item.type === 'collapse' && item.children,
      ) as CollapseItem) || {
        children: [],
        type: 'collapse',
      };
      const sliceCount = maxCount - alwaysDisplayItems.length - 1;
      return [
        ...normalItems.slice(0, sliceCount),
        {
          ...collapseItems,
          children: [
            ...normalItems.filter((item) => item.type !== 'divider').slice(sliceCount),
            ...collapseItems.children,
          ],
        },
        ...alwaysDisplayItems,
      ].filter(Boolean);
    }, [collapsed, items, maxCount]);

    return (
      <TooltipGroup>
        <Flexbox
          align={'center'}
          className={cx(styles.container, className)}
          flex={1}
          gap={gap}
          horizontal
          ref={ref}
          {...rest}
        >
          {calcItem.map((item: any, index) => (
            <ActionItem
              collapsed={collapsed}
              disabled={disabled}
              gap={gap}
              groupCollapsed={groupCollapsed}
              item={item}
              key={item.key || index}
              onActionClick={onActionClick}
              setGroupCollapsed={setGroupCollapsed}
            />
          ))}
        </Flexbox>
      </TooltipGroup>
    );
  },
);

ChatInputActions.displayName = 'ChatInputActions';

export default ChatInputActions;
