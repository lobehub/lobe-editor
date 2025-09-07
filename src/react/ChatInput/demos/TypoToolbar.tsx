import { IEditor } from '@lobehub/editor';
import {
  ChatInputActionBar,
  ChatInputActions,
  ChatInputActionsProps,
  CodeLanguageSelect,
  useEditorState,
} from '@lobehub/editor/react';
import { useTheme } from 'antd-style';
import {
  BoldIcon,
  CodeXmlIcon,
  ItalicIcon,
  LinkIcon,
  ListIcon,
  ListOrderedIcon,
  MessageSquareQuote,
  SigmaIcon,
  SquareDashedBottomCodeIcon,
  StrikethroughIcon,
  UnderlineIcon,
} from 'lucide-react';
import { memo, useMemo } from 'react';

export interface ToolbarProps {
  editor: IEditor;
  show?: boolean;
}

const TypoToolbar = memo<ToolbarProps>(({ show, editor }) => {
  const editorState = useEditorState(editor);
  const theme = useTheme();

  const items: ChatInputActionsProps['items'] = useMemo(
    () =>
      [
        {
          active: editorState.isBold,
          icon: BoldIcon,
          key: 'bold',
          label: 'Bold',
          onClick: editorState.bold,
        },
        {
          active: editorState.isItalic,
          icon: ItalicIcon,
          key: 'italic',
          label: 'Italic',
          onClick: editorState.italic,
        },
        {
          active: editorState.isUnderline,
          icon: UnderlineIcon,
          key: 'underline',
          label: 'Underline',
          onClick: editorState.underline,
        },
        {
          active: editorState.isStrikethrough,
          icon: StrikethroughIcon,
          key: 'strikethrough',
          label: 'Strikethrough',
          onClick: editorState.strikethrough,
        },
        {
          type: 'divider',
        },

        {
          icon: ListIcon,
          key: 'bulletList',
          label: 'bulletList',
          onClick: () => {
            editorState.bulletList();
          },
        },
        {
          icon: ListOrderedIcon,
          key: 'numberlist',
          label: 'numberlist',
          onClick: () => {
            editorState.numberList();
          },
        },
        {
          active: editorState.isBlockquote,
          icon: MessageSquareQuote,
          key: 'blockquote',
          label: 'Blockquote',
          onClick: () => {
            editorState.blockquote();
          },
        },
        {
          icon: LinkIcon,
          key: 'link',
          label: 'link',
          onClick: () => {
            editorState.insertLink();
          },
        },
        {
          icon: SigmaIcon,
          key: 'math',
          label: 'LaTeX',
          onClick: () => {
            editorState.insertMath();
          },
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
        },
        {
          active: editorState.isCodeblock,
          icon: SquareDashedBottomCodeIcon,
          key: 'codeblock',
          label: 'Codeblock',
          onClick: () => {
            editorState.codeblock();
          },
        },
        editorState.isCodeblock && {
          children: (
            <CodeLanguageSelect
              onSelect={(value) => editorState.updateCodeblockLang(value)}
              value={editorState.codeblockLang}
            />
          ),
          disabled: !editorState.isCodeblock,
          key: 'codeblockLang',
        },
      ].filter(Boolean) as ChatInputActionsProps['items'],
    [editorState],
  );

  return (
    <ChatInputActionBar
      left={<ChatInputActions items={items} />}
      style={{
        background: theme.colorFillQuaternary,
        borderTopLeftRadius: 8,
        borderTopRightRadius: 8,
        display: show ? undefined : 'none',
      }}
    />
  );
});

export default TypoToolbar;
