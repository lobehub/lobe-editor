import { addClassNamesToElement, removeClassNamesFromElement } from '@lexical/utils';
import Katex from 'katex';
import {
  $getSelection,
  $isNodeSelection,
  CLICK_COMMAND,
  COMMAND_PRIORITY_NORMAL,
  LexicalEditor,
} from 'lexical';
import { memo, useEffect, useRef, useState } from 'react';

import { useLexicalEditor } from '@/editor-kernel/react';
import { useLexicalNodeSelection } from '@/editor-kernel/react/useLexicalNodeSelection';

import { $isMathNode, MathBlockNode, MathInlineNode } from '../../node';
import Placeholder from './Placeholder';

export interface MathInlineProps {
  className?: string;
  editor: LexicalEditor;
  node: MathInlineNode | MathBlockNode;
}

const MathInline = memo<MathInlineProps>(({ editor, node, className }) => {
  const ref = useRef<HTMLSpanElement>(null);
  const [isSelected, setSelected] = useLexicalNodeSelection(node.getKey());
  const [isEditing, setIsEditing] = useState<boolean>(false);

  useEffect(() => {
    if (ref.current && node.code) {
      Katex.render(node.code, ref.current, {
        throwOnError: false,
      });
    }
  }, [node.code]);

  useEffect(() => {
    const parent = editor.getElementByKey(node.getKey());
    if (parent) {
      // 防抖处理，避免过于频繁的 DOM 操作
      const timeoutId = setTimeout(() => {
        if (isEditing) {
          addClassNamesToElement(parent, 'editing');
          removeClassNamesFromElement(parent, 'selected');
        } else if (isSelected) {
          addClassNamesToElement(parent, 'selected');
          removeClassNamesFromElement(parent, 'editing');
        } else {
          removeClassNamesFromElement(parent, 'selected');
          removeClassNamesFromElement(parent, 'editing');
        }
      }, 10);

      return () => clearTimeout(timeoutId);
    }
  }, [isSelected, isEditing, editor, node]);

  useLexicalEditor(
    (editor) => {
      return editor.registerCommand(
        CLICK_COMMAND,
        (payload) => {
          console.info(payload, payload.target, ref.current);
          if (payload.target && payload.target instanceof Node) {
            // 获取节点对应的 DOM 元素
            const nodeElement = editor.getElementByKey(node.getKey());

            // 对于 block 模式，检查是否点击在整个节点容器内
            // 对于 inline 模式，仍然检查是否点击在渲染内容内
            const isClickInNode =
              node instanceof MathBlockNode
                ? nodeElement?.contains(payload.target)
                : ref.current?.contains(payload.target);

            if (isClickInNode) {
              setSelected(true);
            }
          }
          return false;
        },
        COMMAND_PRIORITY_NORMAL,
      );
    },
    [node],
  );

  // 监听编辑器状态变化来检测编辑状态
  useLexicalEditor(
    (editor) => {
      return editor.registerUpdateListener(() => {
        editor.read(() => {
          const selection = $getSelection();
          if (!$isNodeSelection(selection)) {
            setIsEditing(false);
            return;
          }
          const selectedNode = selection.getNodes()[0];
          if (!$isMathNode(selectedNode)) {
            setIsEditing(false);
            return;
          }
          // 检查是否选中的是当前节点，且有数学编辑器显示
          if (selectedNode.getKey() === node.getKey()) {
            setIsEditing(true);
          } else {
            setIsEditing(false);
          }
        });
      });
    },
    [node],
  );

  return (
    <span className={className} ref={ref}>
      {node.code ? node.code : <Placeholder />}
    </span>
  );
});

export default MathInline;
