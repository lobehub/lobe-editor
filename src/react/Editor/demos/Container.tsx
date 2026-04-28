import { CodeEditor, Collapse, CollapseProps, Highlighter, ToastHost } from '@lobehub/ui';
import { type FC, type PropsWithChildren, useCallback, useEffect, useRef, useState } from 'react';

interface ContainerProps extends Omit<CollapseProps, 'items'> {
  json: string;
  markdown: string;
  onJSONChange?: (json: any) => void;
}

const Container: FC<PropsWithChildren<ContainerProps>> = ({
  children,
  json,
  markdown,
  collapsible = false,
  defaultActiveKey = ['editor', 'text', 'json'],
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
    </>
  );
};

export default Container;
