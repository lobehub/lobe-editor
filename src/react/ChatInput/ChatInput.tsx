'use client';

import { memo } from 'react';
import { Flexbox } from 'react-layout-kit';

import { useStyles } from './style';
import type { ChatInputProps } from './type';

const ChatInput = memo<ChatInputProps>(
  ({ maxHeight = 'min(50vh, 640px)', className, children, footer, header, style }) => {
    const { cx, styles } = useStyles();

    return (
      <Flexbox
        className={cx(styles.container, className)}
        style={{
          maxHeight,
          ...style,
        }}
        width={'100%'}
      >
        {header}
        <div className={styles.editor}>{children}</div>
        {footer}
      </Flexbox>
    );
  },
);

ChatInput.displayName = 'ChatInput';

export default ChatInput;
