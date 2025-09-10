import { mergeRegister } from '@lexical/utils';
import { type TextAreaRef } from 'antd/es/input/TextArea';
import {
  $getSelection,
  $isElementNode,
  $isNodeSelection,
  $isRangeSelection,
  $isTextNode,
} from 'lexical';
import { type FC, type ReactNode, memo, useCallback, useEffect, useRef, useState } from 'react';

import { useLexicalComposerContext, useLexicalEditor } from '@/editor-kernel/react';

import { SELECT_MATH_SIDE_COMMAND, UPDATE_MATH_COMMAND } from '../../command';
import { $isMathNode, MathBlockNode, MathInlineNode } from '../../node';
import { MathEditorContainer } from './MathEditorContainer';
import { MathEditorContent } from './MathEditorContent';

interface MathEditProps {
  /** 自定义渲染组件，接收 MathEditorContent 作为子节点 */
  renderComp?: FC<{ children: ReactNode; open?: boolean }>;
}

const MathEdit = memo<MathEditProps>(({ renderComp }) => {
  const textareaRef = useRef<TextAreaRef>(null);
  const isUpdatingRef = useRef<boolean>(false);
  const [mathNode, setMathNode] = useState<MathInlineNode | MathBlockNode | null>(null);
  const [value, setValue] = useState<string>('');
  // 最近一次成功渲染（校验通过）的 LaTeX
  const lastValidRef = useRef<string>('');
  const isInputValidRef = useRef<boolean>(true);
  const [mathDOM, setMathDOM] = useState<HTMLElement | null>(null);
  const [prev, setPrev] = useState<boolean>(false);
  const [isBlockMode, setIsBlockMode] = useState<boolean>(false);
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [editor] = useLexicalComposerContext();

  // 实时更新节点内容（仅当输入可渲染时才同步到 document）
  useEffect(() => {
    if (!mathNode) return;

    // 使用防抖来避免过于频繁的更新
    const timeoutId = setTimeout(() => {
      // 直接更新节点内容
      const lexicalEditor = editor.getLexicalEditor();
      if (lexicalEditor && !isUpdatingRef.current) {
        // 仅在校验通过时更新文档；失败时不更新，保持最后一次成功渲染
        if (!isInputValidRef.current) {
          return;
        }
        // 检查当前值是否与节点中的值不同，避免不必要的更新
        const currentCode = mathNode.code;
        if (currentCode === value) {
          return; // 值相同，无需更新
        }

        isUpdatingRef.current = true;
        lexicalEditor.update(() => {
          const currentNode = lexicalEditor.getEditorState().read(() => {
            return lexicalEditor.getElementByKey(mathNode.getKey());
          });

          if (currentNode) {
            const writableNode = mathNode.getWritable();
            writableNode.__code = value;
          }
        });
        // 延迟重置更新标志，确保更新监听器不会立即触发
        setTimeout(() => {
          isUpdatingRef.current = false;
        }, 50);
      }
    }, 50); // 增加防抖延迟

    return () => clearTimeout(timeoutId);
  }, [value, mathNode, editor]);

  // 提交逻辑
  const handleSubmit = useCallback(() => {
    if (!mathNode) return;
    const lexicalEditor = editor.getLexicalEditor();
    if (lexicalEditor) {
      // 提交时若当前不可渲染，则使用最近一次成功渲染的内容
      const codeToCommit = isInputValidRef.current ? value : lastValidRef.current;
      lexicalEditor.dispatchCommand(UPDATE_MATH_COMMAND, {
        code: codeToCommit,
        key: mathNode.getKey(),
      });
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

  // 删除节点
  const handleDelete = useCallback(() => {
    if (!mathNode) return;
    const lexicalEditor = editor.getLexicalEditor();
    if (lexicalEditor) {
      lexicalEditor.update(() => {
        mathNode.remove();
      });
    }
  }, [mathNode, editor]);

  // 左箭头导航
  const handleArrowLeft = useCallback(() => {
    if (!mathNode) return;
    editor.dispatchCommand(SELECT_MATH_SIDE_COMMAND, { key: mathNode.getKey(), prev: true });
  }, [mathNode, editor]);

  // 右箭头导航
  const handleArrowRight = useCallback(() => {
    if (!mathNode) return;
    editor.dispatchCommand(SELECT_MATH_SIDE_COMMAND, { key: mathNode.getKey(), prev: false });
  }, [mathNode, editor]);

  // 处理焦点
  const handleFocus = useCallback(() => {
    textareaRef.current?.focus();
    if (prev) {
      textareaRef.current?.resizableTextArea?.textArea?.setSelectionRange(0, 0);
    }
  }, [prev]);

  // 设置 textarea ref
  const setTextareaRef = useCallback((ref: TextAreaRef | null) => {
    textareaRef.current = ref;
  }, []);

  useLexicalEditor(
    (editor) => {
      return mergeRegister(
        editor.registerUpdateListener(({ prevEditorState }) => {
          // 如果正在更新中，跳过此次监听器调用
          if (isUpdatingRef.current) {
            return;
          }

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

            // 检查是否是同一个节点，避免不必要的状态更新
            const isSameNode = mathNode && mathNode.getKey() === node.getKey();

            setMathNode(node);
            // 只有在不是同一个节点或值真正改变时才更新 value
            if (!isSameNode && node.code !== value) {
              setValue(node.code);
              lastValidRef.current = node.code; // 切换节点时以节点里的内容作为最近一次有效值
              isInputValidRef.current = true; // 重置有效状态
            }
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
            setIsOpen(true);
          }

          if (!canEdit) {
            setMathNode(null);
            setMathDOM(null);
            setValue('');
            lastValidRef.current = '';
            isInputValidRef.current = true;
            setIsBlockMode(false);
            setIsOpen(false);
          }
        }),
      );
    },
    [mathNode, value],
  );

  // 构建 MathEditorContent 组件
  const mathEditorContent = (
    <MathEditorContent
      focusRef={setTextareaRef}
      mathNode={mathNode}
      onArrowLeft={handleArrowLeft}
      onArrowRight={handleArrowRight}
      onCancel={handleCancel}
      onDelete={handleDelete}
      onSubmit={handleSubmit}
      onValidationChange={(isValid) => {
        isInputValidRef.current = isValid;
        if (isValid) {
          lastValidRef.current = value;
        }
      }}
      onValueChange={setValue}
      prev={prev}
      value={value}
    />
  );

  // 点击编辑器外部时关闭面板
  useEffect(() => {
    if (!isOpen) return;

    const handlePointerDown = (event: MouseEvent | TouchEvent) => {
      const target = event.target as Node | null;
      if (!target) return;

      const container = document.querySelector(
        '[data-math-editor-container]',
      ) as HTMLElement | null;
      if (container && container.contains(target)) return;

      handleCancel();
    };

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('touchstart', handlePointerDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('touchstart', handlePointerDown);
    };
  }, [isOpen, handleCancel]);

  // 如果有自定义渲染组件，使用它来包装 MathEditorContent
  if (renderComp) {
    return <>{renderComp({ children: mathEditorContent, open: isOpen })}</>;
  }

  // 否则使用默认的 MathEditorContainer
  return (
    <MathEditorContainer
      isBlockMode={isBlockMode}
      mathDOM={mathDOM}
      onFocus={handleFocus}
      prev={prev}
    >
      {mathEditorContent}
    </MathEditorContainer>
  );
});

export default MathEdit;
