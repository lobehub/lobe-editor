import {
  ReactCodeblockPlugin,
  ReactHRPlugin,
  ReactImagePlugin,
  ReactLinkPlugin,
  ReactListPlugin,
} from '@lobehub/editor';
import { ChatInput, useEditor } from '@lobehub/editor/react';
import Editor from '@lobehub/editor/react/Editor';
import { ChatActionsBar, ChatList } from '@lobehub/ui/chat';
import { useTheme } from 'antd-style';
import { useState } from 'react';
import { Flexbox } from 'react-layout-kit';

import ActionToolbar from './ActionToolbar';
import TypoToolbar from './TypoToolbar';
import { chatMessages, content } from './data';

export default () => {
  const [showTypobar, setShowTypobar] = useState(true);
  const theme = useTheme();
  const editorRef = useEditor();

  return (
    <Flexbox
      height={599}
      style={{
        background: theme.colorBgContainerSecondary,
        overflow: 'hidden',
      }}
    >
      <Flexbox
        flex={1}
        style={{
          overflowY: 'auto',
        }}
      >
        <ChatList
          data={chatMessages}
          renderActions={{
            default: ChatActionsBar,
          }}
          renderMessages={{
            default: ({ id, editableContent }) => <div id={id}>{editableContent}</div>,
          }}
          style={{ width: '100%' }}
        />
      </Flexbox>
      <Flexbox paddingBlock={'0 8px'} paddingInline={8}>
        <ChatInput
          footer={<ActionToolbar setShowTypobar={setShowTypobar} showTypobar={showTypobar} />}
          header={<TypoToolbar editorRef={editorRef} show={showTypobar} />}
        >
          <Editor
            content={content}
            editorRef={editorRef}
            mentionOption={{
              items: [
                {
                  label: 'XX',
                  value: 'XX',
                },
              ],
              trigger: '@',
            }}
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
                  label: 'Help',
                  value: 'help',
                },
              ],
              trigger: '/',
            }}
            variant={'chat'}
          />
        </ChatInput>
      </Flexbox>
    </Flexbox>
  );
};
