import { TokenTag } from '@lobehub/ui/chat';
import { Popover } from 'antd';
import {
  GlobeIcon,
  LibraryBigIcon,
  Mic,
  PaperclipIcon,
  SlidersHorizontalIcon,
  TimerOff,
} from 'lucide-react';

import { ChatInputActionBar, ChatInputActions, SendButton } from '@/react';

export default () => {
  return (
    <ChatInputActionBar
      left={
        <ChatInputActions
          items={[
            {
              icon: GlobeIcon,
              key: 'search',
              wrapper: (node) => {
                return (
                  <Popover arrow={false} content={'Test Popover'}>
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
          ]}
        />
      }
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
  );
};
