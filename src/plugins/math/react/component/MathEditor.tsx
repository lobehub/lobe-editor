import { computePosition, flip, offset, shift } from '@floating-ui/dom';
import { mergeRegister } from '@lexical/utils';
import { Block, Button, Hotkey, Text, TextArea } from '@lobehub/ui';
import { type TextAreaRef } from 'antd/es/input/TextArea';
import Katex from 'katex';
import {
  $getSelection,
  $isElementNode,
  $isNodeSelection,
  $isRangeSelection,
  $isTextNode,
  isModifierMatch,
} from 'lexical';
import { type KeyboardEvent, memo, useCallback, useEffect, useRef, useState } from 'react';
import { Flexbox } from 'react-layout-kit';

import { CONTROL_OR_META } from '@/common/sys';
import { useLexicalComposerContext, useLexicalEditor } from '@/editor-kernel/react';
import { useTranslation } from '@/editor-kernel/react/useTranslation';

import { SELECT_MATH_SIDE_COMMAND, UPDATE_MATH_COMMAND } from '../../command';
import { $isMathNode, MathBlockNode, MathInlineNode } from '../../node';
import { useStyles } from '../style';

const MathEdit = memo(() => {
  const t = useTranslation();
  const divRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<TextAreaRef>(null);
  const [mathNode, setMathNode] = useState<MathInlineNode | MathBlockNode | null>(null);
  const [value, setValue] = useState<string>('');
  const [mathDOM, setMathDOM] = useState<HTMLElement | null>(null);
  const [prev, setPrev] = useState<boolean>(false);
  const [isBlockMode, setIsBlockMode] = useState<boolean>(false);
  const [latexError, setLatexError] = useState<string>('');
  const { styles } = useStyles();
  const [editor] = useLexicalComposerContext();

  useEffect(() => {
    if (!mathDOM || !divRef.current) {
      return;
    }

    if (isBlockMode) {
      // Block 模式下，获取主编辑器容器的位置和宽度
      const editorContainer = mathDOM.closest('[contenteditable="true"]');
      if (editorContainer) {
        const containerRect = editorContainer.getBoundingClientRect();
        const mathRect = mathDOM.getBoundingClientRect();

        // 设置编辑器与主编辑器一样宽，位置在数学元素下方
        divRef.current.style.left = `${containerRect.left}px`;
        divRef.current.style.top = `${mathRect.bottom + 8}px`;
        divRef.current.style.width = `${containerRect.width}px`;

        textareaRef.current?.focus();
        if (prev) {
          textareaRef.current?.resizableTextArea?.textArea?.setSelectionRange(0, 0);
        }
        return;
      }
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
        textareaRef.current?.focus();
        if (prev) {
          textareaRef.current?.resizableTextArea?.textArea?.setSelectionRange(0, 0);
        }
      }
    });
  }, [mathDOM, prev, isBlockMode]);

  // 实时验证和更新逻辑
  useEffect(() => {
    if (!mathNode) return;

    if (!value.trim()) {
      setLatexError('');
      return;
    }

    // 使用防抖来避免过于频繁的验证和更新
    const timeoutId = setTimeout(() => {
      try {
        // 创建一个临时元素来测试 LaTeX 是否有效
        const tempDiv = document.createElement('div');
        Katex.render(value, tempDiv, {
          displayMode: isBlockMode,
          throwOnError: true,
        });

        // 验证成功：清除错误，更新节点
        setLatexError('');

        // 直接更新节点内容
        const lexicalEditor = editor.getLexicalEditor();
        if (lexicalEditor) {
          lexicalEditor.update(() => {
            const currentNode = lexicalEditor.getEditorState().read(() => {
              return lexicalEditor.getElementByKey(mathNode.getKey());
            });

            if (currentNode) {
              const writableNode = mathNode.getWritable();
              writableNode.__code = value;
            }
          });
        }
      } catch (error) {
        // 验证失败：只设置错误信息，不更新节点（保持最后正确的渲染）
        const errorMessage = error instanceof Error ? error.message : 'LaTeX Parse Error';
        setLatexError(errorMessage);
        // lastValidCode 保持不变，所以节点显示的内容也保持不变
      }
    }, 200); // 200ms 防抖

    return () => clearTimeout(timeoutId);
  }, [value, isBlockMode, mathNode, editor]);

  // 抽取提交逻辑到独立函数
  const handleSubmit = useCallback(() => {
    if (!mathNode) return;
    const lexicalEditor = editor.getLexicalEditor();
    if (lexicalEditor) {
      // 提交时总是使用原始的 value，不包含错误标记
      lexicalEditor.dispatchCommand(UPDATE_MATH_COMMAND, { code: value, key: mathNode.getKey() });
    }
  }, [editor, mathNode, value]);

  // 取消编辑，不保存更改
  const handleCancel = useCallback(() => {
    if (!mathNode) return;

    const lexicalEditor = editor.getLexicalEditor();
    if (lexicalEditor) {
      // 使用命令来正确设置光标位置到数学节点之后
      lexicalEditor.dispatchCommand(SELECT_MATH_SIDE_COMMAND, {
        key: mathNode.getKey(),
        prev: false,
      });

      // 将焦点返回到编辑器
      lexicalEditor.focus();
    }
  }, [mathNode, editor]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLTextAreaElement>) => {
      if (!mathNode) return;
      if (isModifierMatch(e, CONTROL_OR_META) && e.key === 'Enter') {
        e.preventDefault();
        handleSubmit();
        return;
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        handleCancel();
        return;
      }
      // 当内容为空且按退格键时，删除数学节点
      if (e.key === 'Backspace' && !value.trim()) {
        e.preventDefault();
        const lexicalEditor = editor.getLexicalEditor();
        if (lexicalEditor) {
          lexicalEditor.update(() => {
            mathNode.remove();
          });
        }
        return;
      }
      if (e.key === 'ArrowLeft' && e.currentTarget.selectionStart === 0) {
        e.preventDefault();
        editor.dispatchCommand(SELECT_MATH_SIDE_COMMAND, { key: mathNode.getKey(), prev: true });
      }
      if (
        e.key === 'ArrowRight' &&
        e.currentTarget.selectionStart === e.currentTarget.value.length
      ) {
        e.preventDefault();
        editor.dispatchCommand(SELECT_MATH_SIDE_COMMAND, { key: mathNode.getKey(), prev: false });
      }
    },
    [mathNode, handleSubmit, handleCancel, editor, value],
  );

  useLexicalEditor((editor) => {
    return mergeRegister(
      editor.registerUpdateListener(({ prevEditorState }) => {
        // Handle editor state updates
        const canEdit = editor.read(() => {
          const selection = $getSelection();
          if (!$isNodeSelection(selection)) {
            return false;
          }
          const node = selection.getNodes()[0];
          if (!$isMathNode(node)) {
            // Handle math node
            return false;
          }
          setMathNode(node);
          setValue(node.code);
          setMathDOM(editor.getElementByKey(node.getKey()));
          setIsBlockMode(node instanceof MathBlockNode);
          return node;
        });

        if (canEdit) {
          const node = prevEditorState.read(() => {
            const sel = prevEditorState._selection;
            if (!$isRangeSelection(sel) || !sel.isCollapsed()) {
              return false;
            }
            const node = sel.anchor.getNode();
            if ($isTextNode(node)) {
              return node.getNextSibling();
            }
            if (!$isElementNode(node)) {
              return false;
            }
            return node.getChildAtIndex(sel.anchor.offset);
          });
          if (canEdit === node) {
            setPrev(true);
          } else {
            setPrev(false);
          }
        }

        if (!canEdit) {
          setMathNode(null);
          setMathDOM(null);
          setValue('');
          setIsBlockMode(false);
          setLatexError('');
          if (divRef.current) {
            divRef.current.style.left = `-9999px`;
            divRef.current.style.top = `-9999px`;
          }
        }
      }),
    );
  }, []);

  return (
    <Block
      className={styles.mathEditor}
      ref={divRef}
      shadow
      style={isBlockMode ? { maxWidth: 'none', width: '100%' } : undefined}
      variant={'outlined'}
    >
      <TextArea
        autoFocus
        autoSize={{ maxRows: 6, minRows: 1 }}
        onChange={(e) => {
          setValue(e.target.value);
        }}
        onKeyDown={handleKeyDown}
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
          justify={'flex-end'}
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
            handleSubmit();
          }}
          size={'small'}
          type={'text'}
          variant={'filled'}
        >
          {t('confirm')}
          <Hotkey compact keys="mod+enter" variant={'borderless'} />
        </Button>
      </Flexbox>
    </Block>
  );
});

export default MathEdit;
