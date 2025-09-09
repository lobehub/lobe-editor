import {
  INSERT_HEADING_COMMAND,
  INSERT_HORIZONTAL_RULE_COMMAND,
  INSERT_MENTION_COMMAND,
  INSERT_TABLE_COMMAND,
  ReactCodePlugin,
  ReactCodeblockPlugin,
  ReactHRPlugin,
  ReactImagePlugin,
  ReactLinkPlugin,
  ReactListPlugin,
  ReactMathPlugin,
  ReactTablePlugin,
} from '@lobehub/editor';
import {
  ChatInput,
  Editor,
  FloatMenu,
  SlashMenu,
  useEditor,
  useEditorState,
} from '@lobehub/editor/react';
import { Avatar } from '@lobehub/ui';
import type { ChatMessage } from '@lobehub/ui/chat';
import { Heading1Icon, Heading2Icon, Heading3Icon, MinusIcon, Table2Icon } from 'lucide-react';
import { useRef, useState } from 'react';
import { useHotkeys } from 'react-hotkeys-hook';

import ActionToolbar from './ActionToolbar';
import Container from './Container';
import TypoToolbar from './TypoToolbar';
import { chatMessages, content } from './data';

export default () => {
  const [messages, setMessages] = useState<ChatMessage[]>(chatMessages);
  const [showTypobar, setShowTypobar] = useState(true);
  const editor = useEditor();
  const slashMenuRef = useRef<HTMLDivElement>(null);
  const toolbarState = useEditorState(editor);

  // Shared send message function
  const handleSendMessage = (asAssistant?: boolean) => {
    if (!editor || toolbarState.isEmpty) return;

    setMessages([
      ...messages,
      {
        content: editor.getDocument('markdown') as unknown as string,
        createAt: Date.now(),
        extra: {},
        id: String(Date.now()),
        meta: {
          avatar: 'https://avatars.githubusercontent.com/u/17870709?v=4',
          title: 'CanisMinor',
        },
        role: asAssistant ? 'assistant' : 'user',
        updateAt: Date.now(),
      },
    ]);

    editor.setDocument('text', '');
    editor.focus();
  };

  // Hotkey: Alt + Enter to send message as assistant
  useHotkeys(
    'alt+enter',
    () => {
      console.log('🚀 useHotkeys: alt+enter triggered');
      handleSendMessage(true);
    },
    {
      enableOnContentEditable: true,
      preventDefault: true,
    },
  );

  // Hotkey: alt+n Clean message
  useHotkeys(
    'alt+n',
    () => {
      console.log('🧹 useHotkeys: alt+n triggered');
      setMessages([]);
    },
    {
      enableOnContentEditable: true,
      preventDefault: true,
    },
  );

  return (
    <Container messages={messages}>
      <ChatInput
        footer={
          <ActionToolbar
            onSend={handleSendMessage}
            sendDisabled={toolbarState.isEmpty}
            setShowTypobar={setShowTypobar}
            showTypobar={showTypobar}
          />
        }
        header={<TypoToolbar editor={editor} show={showTypobar} />}
        slashMenuRef={slashMenuRef}
      >
        <Editor
          autoFocus
          content={content}
          editor={editor}
          mentionOption={{
            items: async (search) => {
              console.log(search);
              const data = [
                {
                  icon: <Avatar avatar={'💻'} size={24} />,
                  key: 'bot1',
                  label: '前端研发专家',
                  metadata: { id: 'bot1' },
                },
                {
                  icon: <Avatar avatar={'🌍'} size={24} />,
                  key: 'bot2',
                  label: '中英文互译助手',
                  metadata: { id: 'bot2' },
                },
                {
                  icon: <Avatar avatar={'📖'} size={24} />,
                  key: 'bot3',
                  label: '学术写作增强专家',
                  metadata: { id: 'bot3' },
                },
              ];
              if (!search?.matchingString) return data;
              return data.filter((item) => {
                if (!item.label) return true;
                return item.label.toLowerCase().includes(search.matchingString.toLowerCase());
              });
            },
            markdownWriter: (mention) => {
              return `\n<mention>${mention.label}[${mention.metadata?.id || mention.label}]</mention>\n`;
            },
            onSelect: (editor, option) => {
              editor.dispatchCommand(INSERT_MENTION_COMMAND, {
                label: String(option.label),
                metadata: { id: option.key },
              });
            },
            renderComp: (props) => {
              return <SlashMenu {...props} getPopupContainer={() => slashMenuRef.current} />;
            },
          }}
          onBlur={({ editor, event }) => console.log('Blur', editor, event)}
          onCompositionEnd={({ editor, event }) => console.log('Composition End', editor, event)}
          onCompositionStart={({ editor, event }) =>
            console.log('Composition Start', editor, event)
          }
          onFocus={({ editor, event }) => console.log('Focus', editor, event)}
          onPressEnter={({ event }) => {
            console.log('Enter pressed', { ctrlKey: event.ctrlKey, metaKey: event.metaKey });

            if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
              console.log('[Enter pressed] allowing new line');
              return;
            }

            console.log('[Enter pressed] sending message');
            handleSendMessage();
            return true;
          }}
          placeholder={'Type something...'}
          plugins={[
            ReactListPlugin,
            ReactLinkPlugin,
            ReactImagePlugin,
            ReactCodeblockPlugin,
            ReactHRPlugin,
            ReactCodePlugin,
            ReactTablePlugin,
            Editor.withProps(ReactMathPlugin, {
              renderComp: (props) => (
                <FloatMenu {...props} getPopupContainer={() => slashMenuRef.current} />
              ),
            }),
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
