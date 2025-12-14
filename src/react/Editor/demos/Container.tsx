import { Collapse, CollapseProps, Highlighter } from '@lobehub/ui';
import { type PropsWithChildren, memo } from 'react';

interface ContainerProps extends Omit<CollapseProps, 'items'> {
  json: string;
  markdown: string;
  shouldShowXml?: boolean;
  xml?: string;
}

const Container = memo<PropsWithChildren<ContainerProps>>(
  ({
    children,
    json,
    markdown,
    xml,
    collapsible = false,
    shouldShowXml = false,
    defaultActiveKey = ['editor', 'text', 'json'],
  }) => {
    return (
      <Collapse
        collapsible={collapsible}
        defaultActiveKey={defaultActiveKey}
        items={[
          {
            children: children,
            key: 'editor',
            label: 'Playground',
          },
          {
            children: (
              <Highlighter language={'markdown'} style={{ fontSize: 12 }} variant={'borderless'}>
                {markdown}
              </Highlighter>
            ),
            key: 'text',
            label: 'Text Output',
          },
          ...(shouldShowXml
            ? [
                {
                  children: (
                    <Highlighter language={'xml'} style={{ fontSize: 12 }} variant={'borderless'}>
                      {xml || ''}
                    </Highlighter>
                  ),
                  key: 'xml',
                  label: 'Litexml Output',
                },
              ]
            : []),
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
