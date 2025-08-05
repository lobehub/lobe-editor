import {
  ReactCodeblockPlugin,
  ReactHRPlugin,
  ReactImagePlugin,
  ReactLinkPlugin,
  ReactListPlugin,
} from '@lobehub/editor';
import { Editor } from '@lobehub/editor/react';
import { Typography } from '@lobehub/ui';

import { content } from './data';

export default () => {
  return (
    <Typography>
      <Editor
        className='ignore-markdown-style'
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
        style={{
          padding: 24,
        }}
      />
    </Typography>
  );
};
