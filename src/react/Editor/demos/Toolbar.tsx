import {
  IEditor,
  INSERT_FILE_COMMAND,
  INSERT_IMAGE_COMMAND,
  useToolbarState,
} from '@lobehub/editor';
import { ChatInputActions } from '@lobehub/editor/react';
import { Block } from '@lobehub/ui';
import {
  BoldIcon,
  CodeXmlIcon,
  FileUpIcon,
  ImageIcon,
  ItalicIcon,
  Redo2Icon,
  StrikethroughIcon,
  UnderlineIcon,
  Undo2Icon,
} from 'lucide-react';
import { RefObject, memo } from 'react';

import { openFileSelector } from './actions';

export interface ToolbarProps {
  editorRef: RefObject<IEditor | null>;
}

const Toolbar = memo<ToolbarProps>(({ editorRef }) => {
  const toolbarState = useToolbarState(editorRef);

  return (
    <Block padding={4} shadow style={{ marginBottom: 16 }} variant={'outlined'}>
      <ChatInputActions
        items={[
          {
            disabled: !toolbarState.canUndo,
            icon: Undo2Icon,
            key: 'undo',
            label: 'Undo',
            onClick: toolbarState.undo,
          },
          {
            disabled: !toolbarState.canRedo,
            icon: Redo2Icon,
            key: 'redo',
            label: 'Redo',
            onClick: toolbarState.redo,
          },
          {
            type: 'divider',
          },
          {
            active: toolbarState.isBold,
            icon: BoldIcon,
            key: 'bold',
            label: 'Bold',
            onClick: toolbarState.bold,
          },
          {
            active: toolbarState.isItalic,
            icon: ItalicIcon,
            key: 'italic',
            label: 'Italic',
            onClick: toolbarState.italic,
          },
          {
            active: toolbarState.isUnderline,
            icon: UnderlineIcon,
            key: 'underline',
            label: 'Underline',
            onClick: toolbarState.underline,
          },
          {
            active: toolbarState.isStrikethrough,
            icon: StrikethroughIcon,
            key: 'strikethrough',
            label: 'Strikethrough',
            onClick: toolbarState.strikethrough,
          },
          {
            active: toolbarState.isCode,
            icon: CodeXmlIcon,
            key: 'code',
            label: 'Code',
            onClick: toolbarState.code,
          },
          {
            type: 'divider',
          },
          {
            icon: ImageIcon,
            key: 'image',
            label: 'Image',
            onClick: () => {
              openFileSelector((files) => {
                for (const file of files) {
                  editorRef.current?.dispatchCommand(INSERT_IMAGE_COMMAND, { file });
                }
              }, 'image/*');
            },
          },
          {
            icon: FileUpIcon,
            key: 'file',
            label: 'File',
            onClick: () => {
              openFileSelector((files) => {
                for (const file of files) {
                  editorRef.current?.dispatchCommand(INSERT_FILE_COMMAND, { file });
                }
              });
            },
          },
        ]}
      />
    </Block>
  );
});

export default Toolbar;
