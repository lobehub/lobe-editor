'use client';

import { mergeRegister } from '@lexical/utils';
import { cx } from 'antd-style';
import { CLICK_COMMAND, COMMAND_PRIORITY_LOW, LexicalEditor } from 'lexical';
import { type FC, useEffect } from 'react';

import { useLexicalNodeSelection } from '@/editor-kernel/react/useLexicalNodeSelection';

import { HorizontalRuleNode } from '../../node/HorizontalRuleNode';
import { styles } from '../style';

interface HRNodeProps {
  className?: string;
  editor: LexicalEditor;
  node: HorizontalRuleNode;
}

const HRNode: FC<HRNodeProps> = ({ node, className, editor }) => {
  const [isSelected, setSelected, clearSelection] = useLexicalNodeSelection(node.getKey());

  useEffect(() => {
    return mergeRegister(
      editor.registerCommand(
        CLICK_COMMAND,
        (event: MouseEvent) => {
          const hrElem = editor.getElementByKey(node.getKey());

          if (hrElem?.contains(event.target as HTMLElement) || event.target === hrElem) {
            if (!event.shiftKey) {
              clearSelection();
            }
            setSelected(!isSelected);
            return true;
          }

          return false;
        },
        COMMAND_PRIORITY_LOW,
      ),
    );
  }, [clearSelection, editor, isSelected, node, setSelected]);

  return (
    <div className={cx(styles, isSelected && 'selected', className)}>
      <hr />
    </div>
  );
};

HRNode.displayName = 'HRNode';

export default HRNode;
