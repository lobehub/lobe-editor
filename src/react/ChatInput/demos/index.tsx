import { ChatInput, ChatInputProps, useEditor, useEditorState } from '@lobehub/editor/react';
import type { ChatMessage } from '@lobehub/ui/chat';
import { StoryBook, useControls, useCreateStore } from '@lobehub/ui/storybook';
import { useRef, useState } from 'react';
import { useHotkeys } from 'react-hotkeys-hook';

import ActionToolbar from './ActionToolbar';
import Container from './Container';
import InputEditor from './InputEditor';
import TypoToolbar from './TypoToolbar';
import { chatMessages } from './data';

export default () => {
  const [messages, setMessages] = useState<ChatMessage[]>(chatMessages);
  const [showTypobar, setShowTypobar] = useState(false);
  const editor = useEditor();
  const slashMenuRef = useRef<HTMLDivElement>(null);
  const toolbarState = useEditorState(editor);
  const store = useCreateStore();

  const controls = useControls(
    {
      maxHeight: {
        max: 480,
        min: 240,
        step: 1,
        value: 320,
      },
      minHeight: {
        max: 240,
        min: 16,
        step: 1,
        value: 32,
      },
      resize: true,
      showResizeHandle: false,
    },
    {
      store,
    },
  ) as ChatInputProps;

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
    <StoryBook levaStore={store} noPadding>
      <Container messages={messages}>
        <ChatInput
          defaultHeight={64}
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
          {...controls}
        >
          <InputEditor editor={editor} onSend={handleSendMessage} slashMenuRef={slashMenuRef} />
        </ChatInput>
      </Container>
    </StoryBook>
  );
};
