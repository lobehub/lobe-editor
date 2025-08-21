'use client';

import { memo } from 'react';
import { Flexbox } from 'react-layout-kit';

import { useStyles } from './style';
import type { ChatInputProps } from './type';

const ChatInput = memo<ChatInputProps>(
  ({
    maxHeight = 'min(50vh, 640px)',
    className,
    children,
    footer,
    header,
    style,
    slashMenuRef,
    classNames,
    fullscreen,
    styles: customStyles,
    ...rest
  }) => {
    const { cx, styles } = useStyles();

    return (
      <Flexbox
        className={cx(styles.container, className)}
        height={fullscreen ? '100%' : undefined}
        style={{
          maxHeight: fullscreen ? undefined : maxHeight,
          ...style,
        }}
        width={'100%'}
        {...rest}
      >
        {slashMenuRef && <div ref={slashMenuRef} />}
        {header}
        <div className={cx(styles.editor, classNames?.body)} style={customStyles?.body}>
          {children}
        </div>
        {footer}
      </Flexbox>
    );
  },
);

ChatInput.displayName = 'ChatInput';

export default ChatInput;
