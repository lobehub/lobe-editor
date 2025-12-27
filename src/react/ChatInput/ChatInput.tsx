'use client';

import { Flexbox } from '@lobehub/ui';
import { cx, useThemeMode } from 'antd-style';
import { Resizable } from 're-resizable';
import { type FC, useCallback } from 'react';
import useMergeState from 'use-merge-value';

import { useHeight } from '@/react/hooks/useSize';

import { styles } from './style';
import type { ChatInputProps } from './type';

const ChatInput: FC<ChatInputProps> = (props) => {
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
    onBodyClick,
    styles: customStyles,
    ...rest
  } = props;
  const { isDarkMode } = useThemeMode();
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

  const bodyNode = (
    <div
      className={cx(styles.editor, styles.bodyEditor, classNames?.body)}
      draggable={false}
      onClick={onBodyClick}
      style={{
        ...customStyles?.body,
        maxHeight: fullscreen ? '100%' : maxHeight,
        minHeight: resize ? currentHeight : minHeight,
      }}
    >
      {children}
    </div>
  );

  return (
    <Flexbox
      className={cx(
        isDarkMode ? styles.containerDark : styles.containerLight,
        styles.root,
        className,
      )}
      height={fullscreen ? '100%' : undefined}
      style={style}
      width="100%"
      {...rest}
    >
      {slashMenuRef && <div ref={slashMenuRef} />}
      <div
        className={cx(styles.header, classNames?.header)}
        ref={headerRef}
        style={customStyles?.header}
      >
        {header}
      </div>
      {resize ? (
        <Resizable
          className={styles.resizableContainer}
          enable={fullscreen ? false : { top: true }}
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
          maxHeight={fullscreen ? undefined : maxHeight + resizeMaxHeightOffset}
          minHeight={fullscreen ? undefined : minHeight}
          onResize={handleResize}
          onResizeStop={handleResizeStop}
          size={{ height: fullscreen ? undefined : 'auto', width: '100%' }}
          style={
            fullscreen
              ? {
                  flex: 1,
                  overflow: 'hidden',
                  position: 'relative',
                }
              : undefined
          }
        >
          {bodyNode}
        </Resizable>
      ) : (
        bodyNode
      )}
      <div className={cx(styles.footer, classNames?.footer)} style={customStyles?.footer}>
        {footer}
      </div>
    </Flexbox>
  );
};

ChatInput.displayName = 'ChatInput';

export default ChatInput;
