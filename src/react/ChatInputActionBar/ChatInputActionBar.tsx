'use client';

import { cx, Flexbox } from '@lobehub/ui';
import { type FC } from 'react';

import { styles } from './style';
import type { ChatInputActionBarProps } from './type';

const ChatInputActionBar: FC<ChatInputActionBarProps> = ({
  className,
  style,
  left,
  right,
  ...rest
}) => {
  return (
    <Flexbox
      align={'center'}
      className={cx(styles.container, className)}
      gap={4}
      horizontal
      justify={'space-between'}
      padding={4}
      style={style}
      {...rest}
    >
      {left}
      {right}
    </Flexbox>
  );
};

ChatInputActionBar.displayName = 'ChatInputActionBar';

export default ChatInputActionBar;
