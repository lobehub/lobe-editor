import { Block } from '@lobehub/ui';
import { type ReactNode, memo, useEffect, useRef } from 'react';

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
    const divRef = useRef<HTMLDivElement>(null);

    const updateMathPosition = () => {
      return updatePosition({
        callback: () => {
          if (!divRef.current || !mathDOM) return;
          // 展示的时候聚焦
          onFocus?.();
          if (!isBlockMode) {
            divRef.current.style.width = '';
            return;
          }
          const editorContainer = mathDOM.closest('[contenteditable="true"]') as HTMLElement | null;
          if (editorContainer) {
            const containerRect = editorContainer.getBoundingClientRect();
            divRef.current.style.width = `${containerRect.width}px`;
          }
        },
        floating: divRef.current,
        reference: mathDOM,
      });
    };

    useEffect(() => {
      if (!mathDOM || !divRef.current) return;
      const floating = divRef.current;

      // 监听尺寸变化，随内容变化重新定位
      const resizeObserver = new ResizeObserver(() => updateMathPosition());
      resizeObserver.observe(mathDOM);
      resizeObserver.observe(floating);

      let editorContainer: HTMLElement | null = null;
      if (isBlockMode) {
        editorContainer = mathDOM.closest('[contenteditable="true"]') as HTMLElement | null;
        if (editorContainer) resizeObserver.observe(editorContainer);
      }

      // 窗口尺寸变化时也重新定位
      window.addEventListener('resize', updateMathPosition);

      return () => {
        resizeObserver.disconnect();
        window.removeEventListener('resize', updateMathPosition);
      };
    }, [mathDOM, prev, isBlockMode, onFocus]);

    // 当没有 mathDOM 时，隐藏容器
    useEffect(() => {
      if (mathDOM || !divRef.current) return;
      cleanPosition(divRef.current);
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

export default MathEditorContainer;
