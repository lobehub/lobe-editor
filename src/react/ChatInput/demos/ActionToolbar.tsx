import { ChatInputActionBar, ChatInputActions, SendButton } from '@lobehub/editor/react';
import { TokenTag } from '@lobehub/ui/chat';
import { Popover } from 'antd';
import {
  GlobeIcon,
  LibraryBigIcon,
  Mic,
  PaperclipIcon,
  RemoveFormattingIcon,
  SlidersHorizontalIcon,
  TimerOff,
  TypeIcon,
} from 'lucide-react';
import { type FC } from 'react';

interface ActionToolbarProps {
  onSend?: () => void;
  sendDisabled?: boolean;
  setShowTypobar?: (show: boolean) => void;
  showTypobar?: boolean;
}

const ActionToolbar: FC<ActionToolbarProps> = ({
  sendDisabled,
  showTypobar,
  setShowTypobar,
  onSend,
}) => {
  return (
    <ChatInputActionBar
      left={
        <ChatInputActions
          collapseOffset={100}
          items={[
            {
              icon: showTypobar ? RemoveFormattingIcon : TypeIcon,
              key: 'typo',
              onClick: () => setShowTypobar?.(!showTypobar),
            },
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
          disabled={sendDisabled}
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
          onClick={onSend}
        />
      }
    />
  );
};

export default ActionToolbar;
