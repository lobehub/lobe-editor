import { CodeEditor, Highlighter, ToastHost } from '@lobehub/ui';
import { Accordion } from '@lobehub/ui/base-ui';
import { type FC, type PropsWithChildren, useCallback, useEffect, useRef, useState } from 'react';

import type { IEditor } from '@/types';

import XmlModifier from './XmlModifier';

export interface ContainerLayoutProps {
  collapsible?: boolean;
  defaultActiveKey?: string[];
}

interface ContainerProps extends ContainerLayoutProps {
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
    <>
      <ToastHost />
      <Accordion
        defaultValue={defaultActiveKey}
        hideIndicator={!collapsible}
        value={collapsible ? undefined : defaultActiveKey}
        variant={'outlined'}
        items={[
          {
            children: children,
            key: 'editor',
            title: 'Playground',
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
                  title: 'Litexml Output',
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
            title: 'Text Output',
          },
          {
            children: (
              <CodeEditor
                language={'json'}
                onBlur={() => {
                  if (json !== jsonValueRef.current) {
                    try {
                      const json = JSON.parse(jsonValueRef.current || '');
                      json.keepId = true;
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
            title: 'JSON Output',
          },
        ]}
        style={{
          border: 'none',
          borderRadius: 0,
        }}
        styles={{
          content: { padding: 0 },
        }}
      />
    </>
  );
};

export default Container;
