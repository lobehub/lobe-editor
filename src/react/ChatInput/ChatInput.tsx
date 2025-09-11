'use client';

import { Resizable } from 're-resizable';
import { memo, useCallback } from 'react';
import { Flexbox } from 'react-layout-kit';
import useMergeState from 'use-merge-value';

import { useHeight } from '@/react/hooks/useSize';

import { useStyles } from './style';
import type { ChatInputProps } from './type';

const ChatInput = memo<ChatInputProps>((props) => {
  const {
    defaultHeight = props.defaultHeight || props.minHeight || 64,
    height,
    maxHeight = 320,
    minHeight = 64,
    resizeMaxHeightOffset = 120,
    resize = true,
    onSizeChange,
    onSizeDragging,
    className,
    children,
    footer,
    header,
    style,
    slashMenuRef,
    classNames,
    fullscreen,
    showResizeHandle,
    styles: customStyles,
    ...rest
  } = props;
  const { cx, styles } = useStyles();
  const { ref: headerRef, height: headerHeight = 0 } = useHeight();

  // 使用 useMergeState 管理高度状态
  const [currentHeight, setCurrentHeight] = useMergeState(defaultHeight, {
    defaultValue: defaultHeight,
    onChange: onSizeChange,
    value: height,
  });

  // 处理尺寸变化
  const handleResizeStop = useCallback(
    (e: any, direction: any, ref: HTMLElement) => {
      const newHeight = ref.style.height ? parseInt(ref.style.height) : defaultHeight;
      setCurrentHeight(newHeight);
    },
    [setCurrentHeight, defaultHeight],
  );

  // 处理拖拽过程中的尺寸变化
  const handleResize = useCallback(
    (e: any, direction: any, ref: HTMLElement) => {
      const newHeight = ref.style.height ? parseInt(ref.style.height) : defaultHeight;
      onSizeDragging?.(newHeight);
    },
    [onSizeDragging, defaultHeight],
  );

  // 如果是全屏模式，使用普通的 Flexbox
  if (fullscreen) {
    return (
      <Flexbox
        className={cx(styles.container, className)}
        height="100%"
        style={style}
        width="100%"
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
  }

  const bodyNode = (
    <div
      className={cx(styles.editor, classNames?.body)}
      style={{
        ...customStyles?.body,
        maxHeight,
        minHeight: resize ? currentHeight : minHeight,
        zIndex: 0,
      }}
    >
      {children}
    </div>
  );

  return (
    <Flexbox className={cx(styles.container, className)} style={style} width="100%" {...rest}>
      {slashMenuRef && <div ref={slashMenuRef} />}
      <Flexbox
        className={classNames?.header}
        ref={headerRef}
        style={{
          zIndex: 1,
          ...customStyles?.header,
        }}
        width="100%"
      >
        {header}
      </Flexbox>
      {resize ? (
        <Resizable
          className={styles.resizableContainer}
          enable={{ top: true }}
          handleClasses={{
            top: showResizeHandle ? styles.resizeHandle : undefined,
          }}
          handleStyles={{
            top: {
              backgroundColor: 'transparent',
              borderRadius: '4px',
              cursor: 'ns-resize',
              height: '8px',
              left: '50%',
              top: !!header ? -3 - headerHeight : -3,
              transform: 'translateX(-50%)',
              width: '100%',
            },
          }}
          maxHeight={maxHeight + resizeMaxHeightOffset}
          minHeight={minHeight}
          onResize={handleResize}
          onResizeStop={handleResizeStop}
          size={{ height: 'auto', width: '100%' }}
        >
          {bodyNode}
        </Resizable>
      ) : (
        bodyNode
      )}
      <Flexbox
        className={classNames?.footer}
        style={{
          zIndex: 1,
          ...customStyles?.footer,
        }}
        width="100%"
      >
        {footer}
      </Flexbox>
    </Flexbox>
  );
});

ChatInput.displayName = 'ChatInput';

export default ChatInput;
