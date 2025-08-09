import {
  ReactCodeblockPlugin,
  ReactHRPlugin,
  ReactImagePlugin,
  ReactLinkPlugin,
  ReactListPlugin,
} from '@lobehub/editor';
import {
  ChatInput,
  ChatInputActionBar,
  ChatInputActions,
  ChatInputActionsProps,
  SendButton,
} from '@lobehub/editor/react';
import Editor from '@lobehub/editor/react/Editor';
import { ChatActionsBar, ChatList, TokenTag } from '@lobehub/ui/chat';
import { Popover } from 'antd';
import { useTheme } from 'antd-style';
import {
  GlobeIcon,
  LibraryBigIcon,
  Mic,
  PaperclipIcon,
  SlidersHorizontalIcon,
  TimerOff,
} from 'lucide-react';
import { Flexbox } from 'react-layout-kit';

import { chatMessages, content } from './data';

const items: ChatInputActionsProps['items'] = [
  {
    icon: GlobeIcon,
    key: 'search',
    wrapper: (node, key) => {
      return (
        <Popover arrow={false} content={'Test Popover'} key={key}>
          {node}
        </Popover>
      );
    },
  },
  {
    icon: PaperclipIcon,
    key: 'file',
    label: 'File',
  },
  {
    icon: LibraryBigIcon,
    key: 'library',
    label: 'Library',
  },
  {
    type: 'divider',
  },
  {
    children: [
      {
        icon: SlidersHorizontalIcon,
        key: 'options',
        label: 'Options',
      },
      {
        disabled: true,
        icon: TimerOff,
        key: 'history',
        label: 'History',
      },
      {
        icon: Mic,
        key: 'voice',
        label: 'Voice',
      },
    ],
    type: 'collapse',
  },
  {
    alwaysDisplay: true,
    children: <TokenTag maxValue={2048} value={1024} />,
    key: 'token',
  },
];

export default () => {
  const theme = useTheme();

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
          actions={
            <ChatInputActionBar
              left={<ChatInputActions items={items} />}
              right={
                <SendButton
                  menu={{
                    items: [
                      {
                        key: 'send',
                        label: 'Send',
                        onClick: () => {
                          console.log('Send clicked');
                        },
                      },
                    ],
                  }}
                />
              }
            />
          }
        >
          <Editor
            content={content}
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
