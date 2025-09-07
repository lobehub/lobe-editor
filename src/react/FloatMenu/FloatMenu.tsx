'use client';

import { Block } from '@lobehub/ui';
import { memo } from 'react';
import { createPortal } from 'react-dom';
import { Flexbox } from 'react-layout-kit';

import { useStyles } from './style';
import type { FloatMenuProps } from './type';

const FloatMenu = memo<FloatMenuProps>(
  ({
    className,
    style,
    getPopupContainer,
    children,
    maxHeight = 'min(50vh, 640px)',
    open,
    styles: customStyles,
    classNames,
  }) => {
    const { cx, styles } = useStyles();
    const parent = getPopupContainer();

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
          shadow
          style={{
            maxHeight,
            ...style,
            ...customStyles?.container,
          }}
          variant={'outlined'}
        >
          {children}
        </Block>
      </Flexbox>
    );
    return createPortal(node, parent);
  },
);

FloatMenu.displayName = 'FloatMenu';

export default FloatMenu;
