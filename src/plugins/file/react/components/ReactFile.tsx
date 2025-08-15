import { MaterialFileTypeIcon } from '@lobehub/ui';
import { CLICK_COMMAND, COMMAND_PRIORITY_LOW, LexicalEditor } from 'lexical';
import { useCallback, useEffect, useRef } from 'react';
import { Center } from 'react-layout-kit';

import { useLexicalNodeSelection } from '@/editor-kernel/react/useLexicalNodeSelection';

import { FileNode } from '../../node/FileNode';

export const ReactFile = (props: { className?: string; editor: LexicalEditor; node: FileNode }) => {
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

  if (node.status === 'pending') {
    return <div className={props.className}>File is pending upload...</div>;
  }

  if (node.status === 'error') {
    return <div className={props.className}>Error: {node.message}</div>;
  }

  return (
    <Center className={props.className} gap={'.2em'} horizontal ref={spanRef}>
      <MaterialFileTypeIcon filename={node.name} size={18} type={'file'} variant={'raw'} />
      {node.name}
    </Center>
  );
};
