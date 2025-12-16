import { Collapse, CollapseProps, Highlighter } from '@lobehub/ui';
import { type PropsWithChildren, memo } from 'react';

import { IEditor } from '@/types';

import XmlModifier from './XmlModifier';

interface ContainerProps extends Omit<CollapseProps, 'items'> {
  editor?: IEditor;
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
    editor,
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
          ...(shouldShowXml
            ? [
                {
                  children: (
                    <XmlModifier editor={editor}>
                      <Highlighter language={'xml'} style={{ fontSize: 12 }} variant={'borderless'}>
                        {xml || ''}
                      </Highlighter>
                    </XmlModifier>
                  ),
                  key: 'xml',
                  label: 'Litexml Output',
                },
              ]
            : []),
          {
            children: (
              <Highlighter
                language={'markdown'}
                style={{ fontSize: 12, padding: 16 }}
                variant={'borderless'}
              >
                {markdown}
              </Highlighter>
            ),
            key: 'text',
            label: 'Text Output',
          },
          {
            children: (
              <Highlighter
                language={'json'}
                style={{ fontSize: 12, padding: 16 }}
                variant={'borderless'}
              >
                {json}
              </Highlighter>
            ),
            key: 'json',
            label: 'JSON Output',
          },
        ]}
        padding={{
          body: 0,
        }}
        style={{
          width: '100%',
        }}
      />
    );
  },
);

export default Container;
