import { Button, Hotkey, Text, TextArea , Flexbox } from '@lobehub/ui';
import { type TextAreaRef } from 'antd/es/input/TextArea';
import { renderToString } from 'katex';
import { isModifierMatch } from 'lexical';
import { type KeyboardEvent, memo, useCallback, useEffect, useRef, useState } from 'react';

import { CONTROL_OR_META } from '@/common/sys';
import { useTranslation } from '@/editor-kernel/react/useTranslation';

import { MathBlockNode, MathInlineNode } from '../../node';
import { useStyles } from '../style';

export interface MathEditorContentProps {
  /** 焦点引用 */
  focusRef?: (ref: TextAreaRef | null) => void;
  /** 数学节点 */
  mathNode: MathInlineNode | MathBlockNode | null;
  /** 左箭头回调 */
  onArrowLeft: () => void;
  /** 右箭头回调 */
  onArrowRight: () => void;
  /** 取消回调 */
  onCancel: () => void;
  /** 删除节点回调 */
  onDelete: () => void;
  /** 提交回调 */
  onSubmit: () => void;
  /** 验证状态变化回调 */
  onValidationChange?: (isValid: boolean) => void;
  /** 值变化回调 */
  onValueChange: (value: string) => void;
  /** 是否从前一个位置进入 */
  // prev: boolean;
  /** 当前输入值 */
  value: string;
}

const MathEditorContent = memo<MathEditorContentProps>(
  ({
    focusRef,
    mathNode,
    onArrowLeft,
    onArrowRight,
    onCancel,
    onDelete,
    onSubmit,
    onValidationChange,
    onValueChange,
    // prev,
    value,
  }) => {
    const t = useTranslation();
    const textareaRef = useRef<TextAreaRef>(null);
    const [latexError, setLatexError] = useState<string>('');
    const { styles } = useStyles();

    // 将 ref 暴露给父组件
    useEffect(() => {
      focusRef?.(textareaRef.current);
    }, [focusRef]);

    // // 聚焦和光标位置处理
    // useEffect(() => {
    //   if (textareaRef.current) {
    //     textareaRef.current.focus();
    //     if (prev) {
    //       textareaRef.current.resizableTextArea?.textArea?.setSelectionRange(0, 0);
    //     }
    //   }
    // }, [prev]);

    // 实时验证 LaTeX 语法
    useEffect(() => {
      if (!mathNode) return;

      const isEmpty = !value.trim();

      if (isEmpty) {
        setLatexError('');
        onValidationChange?.(true); // 空值视为有效
        return;
      }

      // 使用防抖来避免过于频繁的验证
      const timeoutId = setTimeout(() => {
        try {
          renderToString(value, {
            displayMode: true,
            throwOnError: true,
          });
          // 验证成功：清除错误，通知父组件验证通过
          setLatexError('');
          onValidationChange?.(true);
        } catch (error) {
          // 验证失败：设置错误信息，通知父组件验证失败
          const errorMessage = error instanceof Error ? error.message : 'LaTeX Parse Error';
          setLatexError(errorMessage);
          onValidationChange?.(false);
        }
      }, 50);

      return () => clearTimeout(timeoutId);
    }, [value, mathNode, onValidationChange]);

    const handleKeyDown = useCallback(
      (e: KeyboardEvent<HTMLTextAreaElement>) => {
        if (!mathNode) return;

        if (isModifierMatch(e, CONTROL_OR_META) && e.key === 'Enter') {
          e.preventDefault();
          onSubmit();
          return;
        }

        if (e.key === 'Escape') {
          e.preventDefault();
          onCancel();
          return;
        }

        // 当内容为空且按退格键时，删除数学节点
        if (e.key === 'Backspace' && !value.trim()) {
          e.preventDefault();
          onDelete();
          return;
        }

        if (e.key === 'ArrowLeft' && e.currentTarget.selectionStart === 0) {
          e.preventDefault();
          onArrowLeft();
        }

        if (
          e.key === 'ArrowRight' &&
          e.currentTarget.selectionStart === e.currentTarget.value.length
        ) {
          e.preventDefault();
          onArrowRight();
        }
      },
      [mathNode, onSubmit, onCancel, onDelete, onArrowLeft, onArrowRight, value],
    );

    return (
      <>
        <TextArea
          autoFocus
          autoSize={{ maxRows: 6, minRows: 1 }}
          onChange={(e) => {
            onValueChange(e.target.value);
          }}
          onKeyDown={handleKeyDown}
          placeholder={`${t('math.placeholder')}...`}
          ref={textareaRef}
          resize={false}
          style={{
            marginBlock: 4,
          }}
          value={value}
          variant={'borderless'}
        />
        {latexError && (
          <Flexbox
            className={styles.mathEditorFooter}
            horizontal
            paddingBlock={4}
            paddingInline={12}
            width={'100%'}
          >
            <Text fontSize={13} type={'danger'}>
              {latexError}
            </Text>
          </Flexbox>
        )}
        <Flexbox
          className={styles.mathEditorFooter}
          horizontal
          justify={'flex-end'}
          padding={4}
          width={'100%'}
        >
          <Button
            onClick={(e) => {
              e.preventDefault();
              onSubmit();
            }}
            size={'small'}
            type={'text'}
            variant={'filled'}
          >
            {t('confirm')}
            <Hotkey compact keys="mod+enter" variant={'borderless'} />
          </Button>
        </Flexbox>
      </>
    );
  },
);

MathEditorContent.displayName = 'MathEditorContent';

export default MathEditorContent;
