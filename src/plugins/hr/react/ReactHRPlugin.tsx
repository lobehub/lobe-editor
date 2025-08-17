'use client';

import { mergeRegister } from '@lexical/utils';
import { CLICK_COMMAND, COMMAND_PRIORITY_LOW, LexicalEditor } from 'lexical';
import type { FC } from 'react';
import { useEffect, useLayoutEffect } from 'react';

import { useLexicalComposerContext } from '@/editor-kernel/react/react-context';
import { useLexicalNodeSelection } from '@/editor-kernel/react/useLexicalNodeSelection';
import { MarkdownPlugin } from '@/plugins/markdown';

import { HorizontalRuleNode } from '../node/HorizontalRuleNode';
import { HRPlugin } from '../plugin';
import { useStyles } from './style';
import { ReactHRPluginProps } from './type';

export const HRNode = ({
  node,
  className,
  editor,
}: {
  className?: string;
  editor: LexicalEditor;
  node: HorizontalRuleNode;
}) => {
  const [isSelected, setSelected, clearSelection] = useLexicalNodeSelection(node.getKey());
  const { cx, styles } = useStyles();
  console.info('HRNode', node, 'isSelected', isSelected);

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
};

const ReactHRPlugin: FC<ReactHRPluginProps> = ({ className }) => {
  const [editor] = useLexicalComposerContext();

  useLayoutEffect(() => {
    editor.registerPlugin(MarkdownPlugin);
    editor.registerPlugin(HRPlugin, {
      decorator(node, editor) {
        return <HRNode className={className} editor={editor} node={node} />;
      },
    });
  }, []);

  return null;
};

ReactHRPlugin.displayName = 'ReactHRPlugin';

export default ReactHRPlugin;
