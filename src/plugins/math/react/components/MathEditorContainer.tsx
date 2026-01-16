import { Flexbox, Popover } from '@lobehub/ui';
import { type ReactNode, memo, useCallback, useEffect, useRef, useState } from 'react';

import { cleanPosition, updatePosition } from '@/utils/updatePosition';

import { styles } from '../style';

export interface MathEditorContainerProps {
  /** 子组件内容 */
  children: ReactNode;
  /** 是否为块模式 */
  isBlockMode: boolean;
  /** 数学节点对应的 DOM 元素 */
  mathDOM: HTMLElement | null;
  /** 焦点回调 */
  onFocus?: () => void;
  /** 是否从前一个位置进入 */
  prev: boolean;
}

const MathEditorContainer = memo<MathEditorContainerProps>(
  ({ children, isBlockMode, mathDOM, onFocus, prev }) => {
    const anchorRef = useRef<HTMLSpanElement>(null);
    const [blockWidth, setBlockWidth] = useState<number | undefined>(undefined);
    const lastBlockWidthRef = useRef<number | undefined>(undefined);

    const setBlockWidthIfNeeded = useCallback((nextWidth?: number) => {
      const normalizedWidth = typeof nextWidth === 'number' ? Math.round(nextWidth) : undefined;
      if (lastBlockWidthRef.current === normalizedWidth) return;
      lastBlockWidthRef.current = normalizedWidth;
      setBlockWidth(normalizedWidth);
    }, []);

    const updateBlockWidth = useCallback(() => {
      if (!isBlockMode) {
        setBlockWidthIfNeeded(undefined);
        return;
      }
      const editorContainer = mathDOM?.closest('[contenteditable="true"]') as HTMLElement | null;
      if (editorContainer) {
        setBlockWidthIfNeeded(editorContainer.getBoundingClientRect().width);
      }
    }, [isBlockMode, mathDOM, setBlockWidthIfNeeded]);

    const updateAnchorPosition = useCallback(() => {
      return updatePosition({
        callback: () => {
          if (!anchorRef.current || !mathDOM) return;
          // 展示的时候聚焦
          onFocus?.();
          updateBlockWidth();
        },
        floating: anchorRef.current,
        placement: isBlockMode ? 'bottom-start' : 'bottom',
        reference: mathDOM,
      });
    }, [isBlockMode, mathDOM, onFocus, updateBlockWidth]);

    const handleAnchorClick = useCallback(() => {
      if (!mathDOM) return;
      updateAnchorPosition();
    }, [mathDOM, updateAnchorPosition]);

    useEffect(() => {
      if (!mathDOM || !anchorRef.current) return;
      const floating = anchorRef.current;

      // 监听尺寸变化，仅更新宽度/位置（不跟随 trigger 尺寸变化）
      const resizeObserver = new ResizeObserver(() => {
        updateBlockWidth();
      });
      resizeObserver.observe(floating);

      let editorContainer: HTMLElement | null = null;
      if (isBlockMode) {
        editorContainer = mathDOM.closest('[contenteditable="true"]') as HTMLElement | null;
        if (editorContainer) resizeObserver.observe(editorContainer);
      }

      updateAnchorPosition();

      // 窗口尺寸变化时也重新定位
      window.addEventListener('resize', updateAnchorPosition);

      return () => {
        resizeObserver.disconnect();
        window.removeEventListener('resize', updateAnchorPosition);
      };
    }, [mathDOM, prev, isBlockMode, updateAnchorPosition]);

    // 当没有 mathDOM 时，隐藏容器
    useEffect(() => {
      if (mathDOM || !anchorRef.current) return;
      cleanPosition(anchorRef.current);
    }, [mathDOM]);

    return (
      <Popover
        arrow={false}
        content={
          <Flexbox
            className={styles.mathEditor}
            data-math-editor-container
            style={blockWidth ? { width: blockWidth } : undefined}
          >
            {children}
          </Flexbox>
        }
        open={!!mathDOM}
        placement={isBlockMode ? 'bottomLeft' : 'bottom'}
        styles={{
          content: {
            borderRadius: '6px',
            padding: 0,
          },
        }}
      >
        <span className={styles.mathEditorAnchor} onClick={handleAnchorClick} ref={anchorRef} />
      </Popover>
    );
  },
);

MathEditorContainer.displayName = 'MathEditorContainer';

export default MathEditorContainer;
