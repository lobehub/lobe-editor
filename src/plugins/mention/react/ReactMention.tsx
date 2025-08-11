import { CLICK_COMMAND, COMMAND_PRIORITY_LOW, LexicalEditor } from 'lexical';
import { useCallback, useEffect, useRef } from 'react';

import { useLexicalNodeSelection } from '@/editor-kernel/react/useLexicalNodeSelection';

import { MentionNode } from '../node/MentionNode';

export const ReactMention = (props: {
  className?: string;
  editor: LexicalEditor;
  node: MentionNode;
}) => {
  const { node, editor } = props;
  const spanRef = useRef<HTMLSpanElement>(null);
  const [, setSelected, clearSelection] = useLexicalNodeSelection(node.getKey());

  const onClick = useCallback(
    (payload: MouseEvent) => {
      if (payload.target === spanRef.current) {
        clearSelection();
        setSelected(true);
        return true; // Indicate that the click was handled
      }
      return false;
    },
    [clearSelection, setSelected],
  );

  useEffect(() => {
    // Perform any necessary side effects here
    return editor.registerCommand<MouseEvent>(CLICK_COMMAND, onClick, COMMAND_PRIORITY_LOW);
  }, [editor, node, onClick]);

  return (
    <span className={props.className} ref={spanRef}>
      @{node.label}
    </span>
  );
};
