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
    }
  }, [isSelected, isEditing]);

  useLexicalEditor((editor) => {
    return editor.registerCommand(
      CLICK_COMMAND,
      (payload) => {
        console.info(payload, payload.target, ref.current);
        if (
          payload.target &&
          payload.target instanceof Node &&
          ref.current?.contains(payload.target)
        ) {
          setSelected(true);
        }
        return false;
      },
      COMMAND_PRIORITY_NORMAL,
    );
  }, []);

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
