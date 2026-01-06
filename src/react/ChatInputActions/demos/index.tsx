import { ChatInputActions, ChatInputActionsProps } from '@lobehub/editor/react';
import { Popover } from '@lobehub/ui';
import { TokenTag } from '@lobehub/ui/chat';
import {
  GlobeIcon,
  LibraryBigIcon,
  Mic,
  PaperclipIcon,
  SlidersHorizontalIcon,
  TimerOff,
} from 'lucide-react';

const items: ChatInputActionsProps['items'] = [
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
  {
    children: <TokenTag maxValue={2048} value={1024} />,
    key: 'token',
  },
];

export default () => {
  return (
    <ChatInputActions
      items={items}
      onActionClick={(actionEvent) => {
        console.log(actionEvent);
      }}
    />
  );
};
