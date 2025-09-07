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
      if (!mathDOM || !divRef.current) {
        return;
      }

      // Inline 模式下使用默认的 floating-ui 定位
      computePosition(mathDOM, divRef.current, {
        middleware: [offset(8), flip(), shift()],
        placement: 'bottom-start',
      }).then(({ x, y }) => {
        if (divRef.current) {
          divRef.current.style.left = `${x}px`;
          divRef.current.style.top = `${y}px`;
          divRef.current.style.width = ''; // 重置宽度
          onFocus?.();
        }

        if (isBlockMode && divRef.current) {
          // Block 模式下，获取主编辑器容器的位置和宽度
          const editorContainer = mathDOM.closest('[contenteditable="true"]');
          if (editorContainer) {
            const containerRect = editorContainer.getBoundingClientRect();
            divRef.current.style.width = `${containerRect.width}px`;
            onFocus?.();
          }
        }
      });
    }, [mathDOM, prev, isBlockMode, onFocus]);

    // 当没有 mathDOM 时，隐藏容器
    useEffect(() => {
      if (!mathDOM && divRef.current) {
        divRef.current.style.left = `-9999px`;
        divRef.current.style.top = `-9999px`;
      }
    }, [mathDOM]);

    return (
      <Block className={styles.mathEditor} ref={divRef} shadow variant={'outlined'}>
        {children}
      </Block>
    );
  },
);

MathEditorContainer.displayName = 'MathEditorContainer';
