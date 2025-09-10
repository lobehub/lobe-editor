import {
  HotkeyEnum,
  IEditor,
  INSERT_FILE_COMMAND,
  INSERT_IMAGE_COMMAND,
  getHotkeyById,
} from '@lobehub/editor';
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
  ListTodoIcon,
  MessageSquareQuote,
  Redo2Icon,
  SigmaIcon,
  SquareDashedBottomCodeIcon,
  StrikethroughIcon,
  UnderlineIcon,
  Undo2Icon,
} from 'lucide-react';
import { memo, useMemo } from 'react';

import { openFileSelector } from './actions';

export interface ToolbarProps {
  editor: IEditor;
}

const Toolbar = memo<ToolbarProps>(({ editor }) => {
  const editorState = useEditorState(editor);
  const theme = useTheme();

  const items = useMemo(
    () =>
      [
        {
          disabled: !editorState.canUndo,
          icon: Undo2Icon,
          key: 'undo',
          label: 'Undo',
          onClick: editorState.undo,
        },
        {
          disabled: !editorState.canRedo,
          icon: Redo2Icon,
          key: 'redo',
          label: 'Redo',
          onClick: editorState.redo,
        },
        {
          type: 'divider',
        },
        {
          active: editorState.isBold,
          icon: BoldIcon,
          key: 'bold',
          label: 'Bold',
          onClick: editorState.bold,
          tooltipProps: { hotkey: getHotkeyById(HotkeyEnum.Bold).keys },
        },
        {
          active: editorState.isItalic,
          icon: ItalicIcon,
          key: 'italic',
          label: 'Italic',
          onClick: editorState.italic,
          tooltipProps: { hotkey: getHotkeyById(HotkeyEnum.Italic).keys },
        },
        {
          active: editorState.isUnderline,
          icon: UnderlineIcon,
          key: 'underline',
          label: 'Underline',
          onClick: editorState.underline,
          tooltipProps: { hotkey: getHotkeyById(HotkeyEnum.Underline).keys },
        },
        {
          active: editorState.isStrikethrough,
          icon: StrikethroughIcon,
          key: 'strikethrough',
          label: 'Strikethrough',
          onClick: editorState.strikethrough,
          tooltipProps: { hotkey: getHotkeyById(HotkeyEnum.Strikethrough).keys },
        },
        {
          type: 'divider',
        },
        {
          icon: ListIcon,
          key: 'bulletList',
          label: 'Bullet List',
          onClick: editorState.bulletList,
          tooltipProps: { hotkey: getHotkeyById(HotkeyEnum.BulletList).keys },
        },
        {
          icon: ListOrderedIcon,
          key: 'numberlist',
          label: 'Number list',
          onClick: editorState.numberList,
          tooltipProps: { hotkey: getHotkeyById(HotkeyEnum.NumberList).keys },
        },
        {
          icon: ListTodoIcon,
          key: 'tasklist',
          label: 'Task list',
          onClick: editorState.checkList,
        },
        {
          type: 'divider',
        },
        {
          active: editorState.isBlockquote,
          icon: MessageSquareQuote,
          key: 'blockquote',
          label: 'Blockquote',
          onClick: editorState.blockquote,
        },
        {
          icon: LinkIcon,
          key: 'link',
          label: 'Link',
          onClick: editorState.insertLink,
          tooltipProps: { hotkey: getHotkeyById(HotkeyEnum.Link).keys },
        },
        {
          icon: SigmaIcon,
          key: 'math',
          label: 'TeX',
          onClick: editorState.insertMath,
        },
        {
          type: 'divider',
        },
        {
          active: editorState.isCode,
          icon: CodeXmlIcon,
          key: 'code',
          label: 'Code',
          onClick: editorState.code,
          tooltipProps: { hotkey: getHotkeyById(HotkeyEnum.CodeInline).keys },
        },
        {
          active: editorState.isCodeblock,
          icon: SquareDashedBottomCodeIcon,
          key: 'codeblock',
          label: 'Codeblock',
          onClick: editorState.codeblock,
        },
        editorState.isCodeblock && {
          children: (
            <CodeLanguageSelect
              onSelect={(value) => {
                console.log(value);
                editorState.updateCodeblockLang(value);
              }}
              value={editorState.codeblockLang}
            />
          ),
          disabled: !editorState.isCodeblock,
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
                editor.dispatchCommand(INSERT_IMAGE_COMMAND, { file });
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
                editor.dispatchCommand(INSERT_FILE_COMMAND, { file });
              }
            });
          },
        },
      ].filter(Boolean) as ChatInputActionsProps['items'],
    [editor, editorState],
  );

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
      <ChatInputActions items={items} />
    </Block>
  );
});

export default Toolbar;
