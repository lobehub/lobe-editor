import { IEditor, useToolbarState } from '@lobehub/editor';
import { ChatInputActionBar, ChatInputActions } from '@lobehub/editor/react';
import { useTheme } from 'antd-style';
import { BoldIcon, CodeXmlIcon, ItalicIcon, StrikethroughIcon, UnderlineIcon } from 'lucide-react';
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
          items={[
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
              active: toolbarState.isCode,
              icon: CodeXmlIcon,
              key: 'code',
              label: 'Code',
              onClick: toolbarState.code,
            },
          ]}
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
