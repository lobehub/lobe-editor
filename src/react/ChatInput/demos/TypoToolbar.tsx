import { HotkeyEnum, IEditor, getHotkeyById } from '@lobehub/editor';
import {
  ChatInputActionBar,
  ChatInputActions,
  ChatInputActionsProps,
  CodeLanguageSelect,
  useEditorState,
} from '@lobehub/editor/react';
import { createStaticStyles, cx } from 'antd-style';
import {
  BoldIcon,
  CodeXmlIcon,
  ItalicIcon,
  LinkIcon,
  ListIcon,
  ListOrderedIcon,
  ListTodoIcon,
  MessageSquareQuote,
  SigmaIcon,
  SquareDashedBottomCodeIcon,
  StrikethroughIcon,
  UnderlineIcon,
} from 'lucide-react';
import { type FC, useMemo } from 'react';

const styles = createStaticStyles(({ css, cssVar }) => ({
  actionBar: css`
    border-start-start-radius: 8px;
    border-start-end-radius: 8px;
    background: ${cssVar.colorFillQuaternary};
  `,
  actionBarHidden: css`
    display: none;
  `,
}));

export interface ToolbarProps {
  editor: IEditor;
  show?: boolean;
}

const TypoToolbar: FC<ToolbarProps> = ({ show, editor }) => {
  const editorState = useEditorState(editor);

  const items: ChatInputActionsProps['items'] = useMemo(
    () =>
      [
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
          label: 'bulletList',
          onClick: editorState.bulletList,
          tooltipProps: { hotkey: getHotkeyById(HotkeyEnum.BulletList).keys },
        },
        {
          icon: ListOrderedIcon,
          key: 'numberlist',
          label: 'numberlist',
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
          label: 'link',
          onClick: editorState.insertLink,
          tooltipProps: { hotkey: getHotkeyById(HotkeyEnum.Link).keys },
        },
        {
          icon: SigmaIcon,
          key: 'math',
          label: 'LaTeX',
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
      className={cx(styles.actionBar, !show && styles.actionBarHidden)}
      left={<ChatInputActions items={items} />}
    />
  );
};

export default TypoToolbar;
