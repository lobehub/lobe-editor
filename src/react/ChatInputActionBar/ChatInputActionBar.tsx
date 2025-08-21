'use client';

import { memo } from 'react';
import { Flexbox } from 'react-layout-kit';

import { useStyles } from './style';
import type { ChatInputActionBarProps } from './type';

const ChatInputActionBar = memo<ChatInputActionBarProps>(
  ({ className, style, left, right, ...rest }) => {
    const { cx, styles } = useStyles();
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
  },
);

ChatInputActionBar.displayName = 'ChatInputActionBar';

export default ChatInputActionBar;
