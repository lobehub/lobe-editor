import { IEditor, ReactBlockPlugin } from '@lobehub/editor';
import { Editor, useEditor } from '@lobehub/editor/react';
import { Button, type CollapseProps, Flexbox, Text } from '@lobehub/ui';
import { debounce } from 'es-toolkit';
import { type FC, useMemo, useState } from 'react';

import Container from './Container';
import content from './disableMakrdownData.json';

const Demo: FC<Pick<CollapseProps, 'collapsible' | 'defaultActiveKey'>> = (props) => {
  const editor = useEditor();
  const [editable, setEditable] = useState(true);
  const [json, setJson] = useState('');
  const [markdown, setMarkdown] = useState('');

  const handleChange = useMemo(
    () =>
      debounce((editor: IEditor) => {
        const markdownContent = editor.getDocument('markdown') as unknown as string;
        const jsonContent = editor.getDocument('json') as unknown as Record<string, any>;
        setMarkdown(markdownContent || '');
        setJson(JSON.stringify(jsonContent || {}, null, 2));
      }, 300),
    [],
  );

  const handleInit = (editor: IEditor) => {
    handleChange(editor);
  };

  return (
    <Container json={json} markdown={markdown} {...props}>
      <Flexbox align={'center'} gap={12} horizontal style={{ padding: 16 }}>
        <Button onClick={() => setEditable((value) => !value)} type={'primary'}>
          Toggle editable (current: {String(editable)})
        </Button>
        <Text type={'secondary'}>
          When editable is false, the left-side add-block / drag handle should disappear.
        </Text>
      </Flexbox>
      <Editor
        content={content}
        editable={editable}
        editor={editor}
        onInit={handleInit}
        onTextChange={handleChange}
        placeholder={'Type something...'}
        plugins={[ReactBlockPlugin]}
      />
    </Container>
  );
};

export default Demo;
