'use client';

import { Block, Menu } from '@lobehub/ui';
import { memo } from 'react';
import { createPortal } from 'react-dom';
import { Flexbox } from 'react-layout-kit';

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
  }) => {
    const { cx, styles } = useStyles();
    const parent = getPopupContainer();
    if (!parent) return;
    if (!open) return;
    const node = (
      <Flexbox className={styles.root} paddingInline={8} width={'100%'}>
        <Block
          className={cx(styles.container, className)}
          gap={4}
          horizontal
          shadow
          style={{
            maxHeight,
            ...style,
          }}
          variant={'outlined'}
        >
          <Menu
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
            selectedKeys={activeKey ? [activeKey] : undefined}
          />
        </Block>
      </Flexbox>
    );
    return createPortal(node, parent);
  },
);

SlashMenu.displayName = 'SlashMenu';

export default SlashMenu;
