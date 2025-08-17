import {
  INSERT_HEADING_COMMAND,
  INSERT_HORIZONTAL_RULE_COMMAND,
  INSERT_MENTION_COMMAND,
  INSERT_TABLE_COMMAND,
  ReactCodeblockPlugin,
  ReactHRPlugin,
  ReactImagePlugin,
  ReactLinkPlugin,
  ReactListPlugin,
  ReactTablePlugin,
  useToolbarState,
} from '@lobehub/editor';
import { ChatInput, SlashMenu, useEditor } from '@lobehub/editor/react';
import Editor from '@lobehub/editor/react/Editor';
import { Avatar } from '@lobehub/ui';
import type { ChatMessage } from '@lobehub/ui/chat';
import { Heading1Icon, Heading2Icon, Heading3Icon, MinusIcon, Table2Icon } from 'lucide-react';
import { useRef, useState } from 'react';

import ActionToolbar from './ActionToolbar';
import Container from './Container';
import TypoToolbar from './TypoToolbar';
import { chatMessages, content } from './data';

export default () => {
  const [messages, setMessages] = useState<ChatMessage[]>(chatMessages);
  const [showTypobar, setShowTypobar] = useState(true);
  const editorRef = useEditor();
  const slashMenuRef = useRef<HTMLDivElement>(null);
  const toolbarState = useToolbarState(editorRef);
  return (
    <Container messages={messages}>
      <ChatInput
        footer={
          <ActionToolbar
            onSend={() => {
              const editor = editorRef.current;
              if (!editor) return;
              setMessages([
                ...messages,
                {
                  content: editor.getDocument('markdown') as unknown as string,
                  createAt: 1_686_437_950_084,
                  extra: {},
                  id: '1',
                  meta: {
                    avatar: 'https://avatars.githubusercontent.com/u/17870709?v=4',
                    title: 'CanisMinor',
                  },
                  role: 'user',
                  updateAt: 1_686_437_950_084,
                },
              ]);

              editor.setDocument('text', '');
              editor.focus();
            }}
            sendDisabled={toolbarState.isEmpty}
            setShowTypobar={setShowTypobar}
            showTypobar={showTypobar}
          />
        }
        header={<TypoToolbar editorRef={editorRef} show={showTypobar} />}
        slashMenuRef={slashMenuRef}
      >
        <Editor
          content={content}
          editorRef={editorRef}
          mentionOption={{
            items: async () => {
              await new Promise((resolve) => {
                setTimeout(() => resolve(true), 1000);
              });
              return [
                {
                  icon: <Avatar avatar={'💻'} size={24} />,
                  key: 'bot1',
                  label: '前端研发专家',
                },
                {
                  icon: <Avatar avatar={'🌍'} size={24} />,
                  key: 'bot2',
                  label: '中英文互译助手',
                },
                {
                  icon: <Avatar avatar={'📖'} size={24} />,
                  key: 'bot3',
                  label: '学术写作增强专家',
                },
              ];
            },
            markdownWriter: (mention) => {
              return `\n<mention>${mention.label}[${mention.extra.id}]</mention>\n`;
            },
            maxLength: 6,
            onSelect: (editor, option) => {
              editor.dispatchCommand(INSERT_MENTION_COMMAND, {
                label: String(option.label),
              });
            },
            renderComp: (props) => {
              return <SlashMenu {...props} getPopupContainer={() => slashMenuRef.current} />;
            },
          }}
          placeholder={'Type something...'}
          plugins={[
            ReactListPlugin,
            ReactLinkPlugin,
            ReactImagePlugin,
            ReactCodeblockPlugin,
            ReactHRPlugin,
            ReactTablePlugin,
          ]}
          slashOption={{
            items: [
              {
                icon: Heading1Icon,
                key: 'h1',
                label: 'Heading 1',
                onSelect: (editor) => {
                  editor.dispatchCommand(INSERT_HEADING_COMMAND, { tag: 'h1' });
                },
              },
              {
                icon: Heading2Icon,
                key: 'h2',
                label: 'Heading 2',
                onSelect: (editor) => {
                  editor.dispatchCommand(INSERT_HEADING_COMMAND, { tag: 'h2' });
                },
              },
              {
                icon: Heading3Icon,
                key: 'h3',
                label: 'Heading 3',
                onSelect: (editor) => {
                  editor.dispatchCommand(INSERT_HEADING_COMMAND, { tag: 'h3' });
                },
              },

              {
                type: 'divider',
              },
              {
                icon: MinusIcon,
                key: 'hr',
                label: 'Hr',
                onSelect: (editor) => {
                  editor.dispatchCommand(INSERT_HORIZONTAL_RULE_COMMAND, {});
                },
              },
              {
                icon: Table2Icon,
                key: 'table',
                label: 'Table',
                onSelect: (editor) => {
                  editor.dispatchCommand(INSERT_TABLE_COMMAND, { columns: '3', rows: '3' });
                },
              },
            ],
            maxLength: 1,
            renderComp: (props) => {
              return <SlashMenu {...props} getPopupContainer={() => slashMenuRef.current} />;
            },
          }}
          variant={'chat'}
        />
      </ChatInput>
    </Container>
  );
};
