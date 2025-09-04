import { IEditor, INSERT_FILE_COMMAND, INSERT_IMAGE_COMMAND } from '@lobehub/editor';
import {
  ChatInputActions,
  ChatInputActionsProps,
  CodeLanguageSelect,
  useEditorState,
} from '@lobehub/editor/react';
import { Block } from '@lobehub/ui';
import { useTheme } from 'antd-style';
import {
  BoldIcon,
  CodeXmlIcon,
  FileUpIcon,
  ImageIcon,
  ItalicIcon,
  LinkIcon,
  ListIcon,
  ListOrderedIcon,
  Redo2Icon,
  SquareDashedBottomCodeIcon,
  StrikethroughIcon,
  UnderlineIcon,
  Undo2Icon,
} from 'lucide-react';
import { type RefObject, memo } from 'react';

import { openFileSelector } from './actions';

export interface ToolbarProps {
  editorRef: RefObject<IEditor | null>;
}

const Toolbar = memo<ToolbarProps>(({ editorRef }) => {
  const toolbarState = useEditorState(editorRef);
  const theme = useTheme();

  return (
    <Block
      padding={4}
      shadow
      style={{
        background: theme.colorBgElevated,
        marginBottom: 16,
        position: 'sticky',
        top: 12,
        zIndex: 10,
      }}
      variant={'outlined'}
    >
      <ChatInputActions
        items={
          [
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
              type: 'divider',
            },
            {
              icon: LinkIcon,
              key: 'link',
              label: 'Link',
              onClick: () => {
                toolbarState.insertLink();
              },
            },
            {
              icon: ListIcon,
              key: 'bulletList',
              label: 'Bullet List',
              onClick: () => {
                toolbarState.bulletList();
              },
            },
            {
              icon: ListOrderedIcon,
              key: 'numberlist',
              label: 'Number list',
              onClick: () => {
                toolbarState.numberList();
              },
            },
            {
              type: 'divider',
            },
            {
              active: toolbarState.isCode,
              icon: CodeXmlIcon,
              key: 'code',
              label: 'Code',
              onClick: toolbarState.code,
            },
            !toolbarState.isInCodeblock && {
              icon: SquareDashedBottomCodeIcon,
              key: 'codeblock',
              label: 'Codeblock',
              onClick: () => {
                toolbarState.formatCodeblock();
              },
            },
            toolbarState.isInCodeblock && {
              children: (
                <CodeLanguageSelect
                  onSelect={(value) => {
                    console.log(value);
                    toolbarState.updateCodeblockLang(value);
                  }}
                  value={toolbarState.codeblockLang}
                />
              ),
              disabled: !toolbarState.isInCodeblock,
              key: 'codeblockLang',
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
          ].filter(Boolean) as ChatInputActionsProps['items']
        }
      />
    </Block>
  );
});

export default Toolbar;
