import { Collapse, Highlighter } from '@lobehub/ui';
import { PropsWithChildren, memo } from 'react';

const Container = memo<PropsWithChildren<{ json: string; text: string }>>(
  ({ children, json, text }) => {
    return (
      <Collapse
        activeKey={['editor', 'text', 'json']}
        collapsible={false}
        items={[
          {
            children: children,
            key: 'editor',
            label: 'Playground',
          },
          {
            children: (
              <Highlighter language={'text'} style={{ fontSize: 12 }} variant={'borderless'}>
                {text}
              </Highlighter>
            ),
            key: 'text',
            label: 'Text Output',
          },
          {
            children: (
              <Highlighter language={'json'} style={{ fontSize: 12 }} variant={'borderless'}>
                {json}
              </Highlighter>
            ),
            key: 'json',
            label: 'JSON Output',
          },
        ]}
        style={{
          width: '100%',
        }}
      />
    );
  },
);

export default Container;
