import {
  ReactCodeblockPlugin,
  ReactHRPlugin,
  ReactImagePlugin,
  ReactLinkPlugin,
  ReactListPlugin,
} from '@lobehub/editor';
import { ChatInput, useEditor } from '@lobehub/editor/react';
import Editor from '@lobehub/editor/react/Editor';
import type { ChatMessage } from '@lobehub/ui/chat';
import { useState } from 'react';

import ActionToolbar from './ActionToolbar';
import Container from './Container';
import TypoToolbar from './TypoToolbar';
import { chatMessages, content } from './data';

export default () => {
  const [messages, setMessages] = useState<ChatMessage[]>(chatMessages);
  const [showTypobar, setShowTypobar] = useState(true);
  const editorRef = useEditor();

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
            setShowTypobar={setShowTypobar}
            showTypobar={showTypobar}
          />
        }
        header={<TypoToolbar editorRef={editorRef} show={showTypobar} />}
      >
        <Editor
          content={content}
          editorRef={editorRef}
          mentionOption={{
            items: [
              {
                key: 'XX',
                label: 'XX',
              },
            ],
            trigger: '@',
          }}
          placeholder={'Type something...'}
          plugins={[
            ReactListPlugin,
            ReactLinkPlugin,
            ReactImagePlugin,
            ReactCodeblockPlugin,
            ReactHRPlugin,
          ]}
          slashOption={{
            items: [
              {
                key: 'help',
                label: 'Help',
              },
            ],
            trigger: '/',
          }}
          variant={'chat'}
        />
      </ChatInput>
    </Container>
  );
};
