import { Center } from '@lobehub/ui';
import type { LexicalEditor } from 'lexical';
import { CLICK_COMMAND, COMMAND_PRIORITY_LOW } from 'lexical';
import { type FC, useCallback, useEffect, useRef } from 'react';

import { useLexicalNodeSelection } from '@/editor-kernel/react/useLexicalNodeSelection';
import { useTranslation } from '@/editor-kernel/react/useTranslation';

import type { FileNode } from '../../node/FileNode';
import type { FileActionPayload } from '../type';
import FileBody from './FileBody';

interface ReactFileProps {
  className?: string;
  editor: LexicalEditor;
  node: FileNode;
  onDownload?: (file: FileActionPayload) => void;
  onPreview?: (file: FileActionPayload) => void;
}

const ReactFile: FC<ReactFileProps> = ({ className, editor, node, onDownload, onPreview }) => {
  const spanRef = useRef<HTMLSpanElement>(null);
  const t = useTranslation();
  const [, setSelected, clearSelection] = useLexicalNodeSelection(node.getKey());

  const onClick = useCallback(
    (payload: MouseEvent) => {
      const target = payload.target as Node | null;
      if (target && spanRef.current?.contains(target)) {
        clearSelection();
        setSelected(true);
        return true;
      }
      return false;
    },
    [clearSelection, setSelected],
  );

  useEffect(() => {
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
      <FileBody
        downloadLabel={t('file.download')}
        ext={node.ext}
        fileUrl={node.fileUrl}
        mimeType={node.mimeType}
        name={node.name}
        onDownload={onDownload}
        onPreview={onPreview}
        previewLabel={t('file.preview')}
        size={node.size}
      />
    </Center>
  );
};

ReactFile.displayName = 'ReactFile';

export default ReactFile;
