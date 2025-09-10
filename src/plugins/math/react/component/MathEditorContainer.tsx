import { computePosition, flip, offset, shift } from '@floating-ui/dom';
import { Block } from '@lobehub/ui';
import { type ReactNode, memo, useEffect, useRef } from 'react';

import { useStyles } from '../style';

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

export const MathEditorContainer = memo<MathEditorContainerProps>(
  ({ children, isBlockMode, mathDOM, onFocus, prev }) => {
    const divRef = useRef<HTMLDivElement>(null);
    const { styles } = useStyles();

    useEffect(() => {
      if (!mathDOM || !divRef.current) return;

      const floating = divRef.current;

      const updatePosition = () => {
        if (!mathDOM || !floating) return;
        computePosition(mathDOM, floating, {
          middleware: [offset(8), flip(), shift()],
          placement: 'bottom-start',
        }).then(({ x, y }) => {
          if (!floating) return;
          floating.style.left = `${x}px`;
          floating.style.top = `${y}px`;
          floating.style.width = '';

          if (isBlockMode) {
            const editorContainer = mathDOM.closest(
              '[contenteditable="true"]',
            ) as HTMLElement | null;
            if (editorContainer) {
              const containerRect = editorContainer.getBoundingClientRect();
              floating.style.width = `${containerRect.width}px`;
            }
          }
        });
      };

      // 监听尺寸变化，随内容变化重新定位
      const resizeObserver = new ResizeObserver(() => updatePosition());
      resizeObserver.observe(mathDOM);
      resizeObserver.observe(floating);

      let editorContainer: HTMLElement | null = null;
      if (isBlockMode) {
        editorContainer = mathDOM.closest('[contenteditable="true"]') as HTMLElement | null;
        if (editorContainer) resizeObserver.observe(editorContainer);
      }

      // 窗口尺寸变化时也重新定位
      window.addEventListener('resize', updatePosition);

      return () => {
        resizeObserver.disconnect();
        window.removeEventListener('resize', updatePosition);
      };
    }, [mathDOM, prev, isBlockMode, onFocus]);

    // 当没有 mathDOM 时，隐藏容器
    useEffect(() => {
      if (!mathDOM && divRef.current) {
        divRef.current.style.left = `-9999px`;
        divRef.current.style.top = `-9999px`;
      }
    }, [mathDOM]);

    return (
      <Block
        className={styles.mathEditor}
        data-math-editor-container
        onClick={(e) => {
          e.preventDefault();
        }}
        ref={divRef}
        shadow
        variant={'outlined'}
      >
        {children}
      </Block>
    );
  },
);

MathEditorContainer.displayName = 'MathEditorContainer';
