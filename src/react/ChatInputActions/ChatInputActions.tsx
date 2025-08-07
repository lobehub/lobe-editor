'use client';

import { ActionIcon } from '@lobehub/ui';
import { Divider } from 'antd';
import { ReactNode, memo, useCallback } from 'react';
import { Flexbox } from 'react-layout-kit';

import ChatInputActionsCollapse from './components/ChatInputActionsCollapse';
import { useStyles } from './style';
import type { ActionItem, ChatInputActionsProps, DividerItem } from './type';

const ChatInputActions = memo<ChatInputActionsProps>(
  ({ gap = 2, disabled, actionIconProps, items = [], onActionClick, className, ...rest }) => {
    const { cx, styles } = useStyles();

    const mapActions = useCallback(
      (item: ActionItem | DividerItem, i: number) => {
        if (item.type === 'divider') {
          const size = actionIconProps?.size;
          return (
            <Divider
              className={styles.divider}
              key={i}
              style={{
                height: (size && typeof size === 'object' ? size.size : size) || 20,
              }}
              type={'vertical'}
            />
          );
        }

        const { wrapper, icon, key, label, onClick, danger, loading, ...itemRest } = item;

        const node: ReactNode = item.children || (
          <ActionIcon
            danger={danger}
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
            {...actionIconProps}
            disabled={disabled || loading || itemRest?.disabled}
            tooltipProps={{
              placement: 'top',
              ...actionIconProps?.tooltipProps,
            }}
          />
        );

        if (!wrapper) return node;
        return wrapper(node, String(key));
      },
      [actionIconProps, disabled, onActionClick, styles.divider],
    );

    return (
      <Flexbox
        align={'center'}
        className={cx(styles.container, className)}
        flex={'none'}
        gap={gap}
        horizontal
        {...rest}
      >
        {items.map((item, index) => {
          if (item.type === 'collapse') {
            return (
              <ChatInputActionsCollapse
                actionIconProps={actionIconProps}
                defaultExpand={item.defaultExpand}
                expand={item.expand}
                gap={gap}
                key={index}
                onChange={item.onChange}
              >
                {item.children.map((child, childIndex) => mapActions(child, childIndex))}
              </ChatInputActionsCollapse>
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
