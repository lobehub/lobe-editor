import {
  ReactCodeblockPlugin,
  ReactHRPlugin,
  ReactImagePlugin,
  ReactLinkPlugin,
  ReactListPlugin,
  ReactTablePlugin,
  INSERT_TABLE_COMMAND,
} from '@lobehub/editor';
import { Editor } from '@lobehub/editor/react';
import { Typography } from '@lobehub/ui';

import { content } from './data';

export default () => {
  return (
    <Typography>
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
          ReactTablePlugin,
        ]}
        slashOption={{
          items: [
            {
              label: 'Table',
              onSelect: (editor) => {
                editor.dispatchCommand(INSERT_TABLE_COMMAND, { columns: '3', rows: '3' });
              },
              value: 'table',
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
