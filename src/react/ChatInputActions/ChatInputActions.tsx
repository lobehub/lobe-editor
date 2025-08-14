'use client';

import { ActionIcon, Dropdown } from '@lobehub/ui';
import { useSize } from 'ahooks';
import { Divider } from 'antd';
import { ReactNode, memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Flexbox } from 'react-layout-kit';

import ChatInputActionsCollapse from './components/ChatInputActionsCollapse';
import { useStyles } from './style';
import type { ActionItem, ChatInputActionsProps, CollapseItem, DividerItem } from './type';

const ChatInputActions = memo<ChatInputActionsProps>(
  ({ gap = 2, disabled, items = [], onActionClick, className, ...rest }) => {
    const { cx, styles } = useStyles();
    const [maxCount, setMaxCount] = useState(items.length);
    const [collapsed, setCollapsed] = useState(false);
    const ref = useRef(null);
    const size = useSize(ref);

    const flatItems = useMemo(
      () =>
        items
          .flatMap((item) => {
            if (item.type === 'collapse' && item.children) {
              return item.children;
            }
            return item;
          })
          .filter((item) => item.type !== 'divider'),
      [items],
    );

    useEffect(() => {
      if (!size?.width) return;
      const length = flatItems.length + 1;
      console.log(size?.width);
      const calcMaxCount = Math.floor(size.width / 48);
      setMaxCount(calcMaxCount);
      console.log(calcMaxCount < length);
      if (calcMaxCount < length) {
        setCollapsed(true);
      } else {
        setCollapsed(false);
      }
    }, [size, flatItems.length]);

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
    }, [collapsed, items, flatItems, maxCount]);

    const mapActions = useCallback(
      (item: ActionItem | DividerItem, i: number) => {
        if (item.type === 'divider') {
          return (
            <Divider
              className={styles.divider}
              key={i}
              style={{
                height: 20,
              }}
              type={'vertical'}
            />
          );
        }

        const { wrapper, icon, key, label, onClick, danger, loading, ...itemRest } = item;

        const node: ReactNode = item.children || (
          <ActionIcon
            active={item.active}
            danger={danger}
            disabled={disabled || loading || itemRest?.disabled}
            icon={icon}
            key={key}
            loading={loading}
            onClick={(e) => {
              onActionClick?.({
                domEvent: e,
                key: String(key),
                keyPath: [String(key)],
              });
              onClick?.(e as any);
            }}
            size={{
              blockSize: 36,
              size: 20,
            }}
            title={label}
            tooltipProps={{
              placement: 'top',
            }}
          />
        );

        if (!wrapper) return node;
        return wrapper(node, String(key));
      },
      [disabled, onActionClick, styles.divider],
    );

    return (
      <Flexbox
        align={'center'}
        className={cx(styles.container, className)}
        flex={'none'}
        gap={gap}
        horizontal
        ref={ref}
        {...rest}
      >
        {calcItem.map((item, index) => {
          if (item.type === 'collapse') {
            return (
              <ChatInputActionsCollapse
                defaultExpand={item.defaultExpand}
                expand={item.expand}
                gap={gap}
                key={index}
                mode={collapsed ? 'popup' : 'default'}
                onChange={item.onChange}
              >
                {item.children.map((child, childIndex) => mapActions(child as any, childIndex))}
              </ChatInputActionsCollapse>
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
                  }}
                />
              </Dropdown>
            );
          }
          return mapActions(item, index);
        })}
      </Flexbox>
    );
  },
);

ChatInputActions.displayName = 'ChatInputActions';

export default ChatInputActions;
