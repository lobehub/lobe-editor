import { MaterialFileTypeIcon , Center } from '@lobehub/ui';
import { CLICK_COMMAND, COMMAND_PRIORITY_LOW, LexicalEditor } from 'lexical';
import { type FC, useCallback, useEffect, useRef } from 'react';

import { useLexicalNodeSelection } from '@/editor-kernel/react/useLexicalNodeSelection';
import { useTranslation } from '@/editor-kernel/react/useTranslation';

import { FileNode } from '../../node/FileNode';

interface ReactFileProps {
  className?: string;
  editor: LexicalEditor;
  node: FileNode;
}

const ReactFile: FC<ReactFileProps> = ({ className, editor, node }) => {
  const spanRef = useRef<HTMLSpanElement>(null);
  const t = useTranslation();
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
    return <div className={className}>{t('file.uploading')}</div>;
  }

  if (node.status === 'error') {
    return (
      <div className={className}>
        {t('file.error', { message: node.message || 'Unknown error' })}
      </div>
    );
  }

  return (
    <Center className={className} gap={'.2em'} horizontal ref={spanRef}>
      <MaterialFileTypeIcon filename={node.name} size={18} type={'file'} variant={'raw'} />
      {node.name}
    </Center>
  );
};

ReactFile.displayName = 'ReactFile';

export default ReactFile;
