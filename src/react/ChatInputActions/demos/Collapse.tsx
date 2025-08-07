import { ChatInputActions, ChatInputActionsProps } from '@lobehub/editor/react';
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
    label: 'Search',
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
