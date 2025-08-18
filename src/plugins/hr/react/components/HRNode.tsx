'use client';

import { mergeRegister } from '@lexical/utils';
import { CLICK_COMMAND, COMMAND_PRIORITY_LOW, LexicalEditor } from 'lexical';
import { memo, useEffect } from 'react';

import { useLexicalNodeSelection } from '@/editor-kernel/react/useLexicalNodeSelection';

import { HorizontalRuleNode } from '../../node/HorizontalRuleNode';
import { useStyles } from '../style';

interface HRNodeProps {
  className?: string;
  editor: LexicalEditor;
  node: HorizontalRuleNode;
}

const HRNode = memo<HRNodeProps>(({ node, className, editor }) => {
  const [isSelected, setSelected, clearSelection] = useLexicalNodeSelection(node.getKey());
  const { cx, styles } = useStyles();

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

  return <hr className={cx(styles, isSelected && 'selected', className)} />;
});

HRNode.displayName = 'HRNode';

export default HRNode;
