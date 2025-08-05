import { ChatInput } from '@lobehub/editor/react';
import { Flexbox } from 'react-layout-kit';

import { content } from './data';

export default () => {
  return (
    <Flexbox height={600} padding={24}>
      <div style={{ flex: 1 }} />
      <ChatInput
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
        slashOption={{
          items: [
            {
              label: 'Help',
              value: 'help',
            },
          ],
          trigger: '/',
        }}
      />
    </Flexbox>
  );
};
