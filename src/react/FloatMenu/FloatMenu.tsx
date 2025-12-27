'use client';

import { Block, Flexbox } from '@lobehub/ui';
import { cx } from 'antd-style';
import { type FC } from 'react';
import { createPortal } from 'react-dom';

import { styles } from './style';
import type { FloatMenuProps } from './type';

const FloatMenu: FC<FloatMenuProps> = ({
  className,
  style,
  getPopupContainer,
  children,
  maxHeight = 'min(50vh, 640px)',
  open,
  styles: customStyles,
  classNames,
}) => {
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
};

FloatMenu.displayName = 'FloatMenu';

export default FloatMenu;
