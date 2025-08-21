'use client';

import { Block, Menu, type MenuProps } from '@lobehub/ui';
import { memo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Flexbox } from 'react-layout-kit';

import { ISlashMenuOption } from '@/plugins/slash/service/i-slash-service';

import { useStyles } from './style';
import type { SlashMenuProps } from './type';

const SlashMenu = memo<SlashMenuProps>(
  ({
    className,
    style,
    getPopupContainer,
    open,
    options,
    activeKey,
    loading,
    maxHeight = 'min(50vh, 640px)',
    onSelect,
    styles: customStyles,
    classNames,
    menuProps,
  }) => {
    const { cx, styles } = useStyles();
    const parent = getPopupContainer();

    const handleMenuClick: MenuProps['onClick'] = useCallback(
      ({ key }: { key: string }) => {
        if (!onSelect) return;
        const option = options.find(
          (item): item is ISlashMenuOption => 'key' in item && item.key === key,
        );
        if (option) onSelect?.(option);
      },
      [options, onSelect],
    );

    if (!parent) return;
    if (!open) return;

    const node = (
      <Flexbox
        className={cx(styles.root, classNames?.root)}
        paddingInline={8}
        style={customStyles?.root}
        width={'100%'}
      >
        <Block
          className={cx(styles.container, className, classNames?.container)}
          gap={4}
          horizontal
          shadow
          style={{
            maxHeight,
            ...style,
            ...customStyles?.container,
          }}
          variant={'outlined'}
        >
          <Menu
            className={classNames?.menu}
            items={
              loading
                ? [
                    {
                      disabled: true,
                      key: 'loading',
                      label: 'Loading...',
                    },
                  ]
                : options
            }
            mode={'inline'}
            onClick={handleMenuClick}
            selectedKeys={activeKey ? [activeKey] : undefined}
            style={customStyles?.menu}
            {...menuProps}
          />
        </Block>
      </Flexbox>
    );
    return createPortal(node, parent);
  },
);

SlashMenu.displayName = 'SlashMenu';

export default SlashMenu;
