import { CodeEditor, Collapse, CollapseProps, Highlighter } from '@lobehub/ui';
import { type FC, type PropsWithChildren, useCallback, useEffect, useRef, useState } from 'react';

import { IEditor } from '@/types';

import XmlModifier from './XmlModifier';

interface ContainerProps extends Omit<CollapseProps, 'items'> {
  editor?: IEditor;
  json: string;
  markdown: string;
  onJSONChange?: (json: any) => void;
  shouldShowXml?: boolean;
  xml?: string;
}

const Container: FC<PropsWithChildren<ContainerProps>> = ({
  children,
  json,
  markdown,
  xml,
  collapsible = false,
  shouldShowXml = false,
  defaultActiveKey = ['editor', 'text', 'json'],
  editor,
  onJSONChange,
}) => {
  const [value, setValue] = useState(json);
  const jsonValueRef = useRef(json);

  useEffect(() => {
    if (json === jsonValueRef.current) return;
    setValue(json);
    jsonValueRef.current = json;
  }, [json]);

  const handleJSONChange = useCallback((value: string) => {
    jsonValueRef.current = value;
    setValue(value);
  }, []);

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
            <CodeEditor
              language={'json'}
              onBlur={() => {
                if (json !== jsonValueRef.current) {
                  try {
                    const json = JSON.parse(jsonValueRef.current || '');
                    onJSONChange?.(json);
                  } catch (error) {
                    console.error('Invalid JSON:', error);
                  }
                }
              }}
              onValueChange={handleJSONChange}
              value={value}
              variant={'borderless'}
            />
          ),
          key: 'json',
          label: 'JSON Output',
        },
      ]}
      padding={{
        body: 0,
      }}
      style={{
        border: 'none',
        borderRadius: 0,
        width: '100%',
      }}
      variant={'outlined'}
    />
  );
};

export default Container;
