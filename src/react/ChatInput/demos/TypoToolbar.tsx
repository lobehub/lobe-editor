import { IEditor, useToolbarState } from '@lobehub/editor';
import {
  ChatInputActionBar,
  ChatInputActions,
  ChatInputActionsProps,
  CodeLanguageSelect,
} from '@lobehub/editor/react';
import { useTheme } from 'antd-style';
import {
  BoldIcon,
  CodeXmlIcon,
  ItalicIcon,
  LinkIcon,
  ListIcon,
  ListOrderedIcon,
  SquareDashedBottomCodeIcon,
  StrikethroughIcon,
  UnderlineIcon,
} from 'lucide-react';
import { RefObject, memo } from 'react';

export interface ToolbarProps {
  editorRef: RefObject<IEditor | null>;
  show?: boolean;
}

const TypoToolbar = memo<ToolbarProps>(({ show, editorRef }) => {
  const toolbarState = useToolbarState(editorRef);
  const theme = useTheme();

  return (
    <ChatInputActionBar
      left={
        <ChatInputActions
          items={
            [
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
                label: 'link',
                onClick: () => {
                  toolbarState.insertLink();
                },
              },
              {
                icon: ListIcon,
                key: 'bulletList',
                label: 'bulletList',
                onClick: () => {
                  toolbarState.bulletList();
                },
              },
              {
                icon: ListOrderedIcon,
                key: 'numberlist',
                label: 'numberlist',
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
                    onSelect={(value) => toolbarState.updateCodeblockLang(value)}
                  />
                ),
                disabled: !toolbarState.isInCodeblock,
                key: 'codeblockLang',
              },
            ].filter(Boolean) as ChatInputActionsProps['items']
          }
        />
      }
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
