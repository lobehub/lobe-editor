import { IEditor } from '@lobehub/editor';
import { Editor, useEditor } from '@lobehub/editor/react';
import { debounce } from 'es-toolkit';
import { type FC, useState } from 'react';

import Container from './Container';

const Demo: FC = () => {
  const editor = useEditor();
  const [json, setJson] = useState('');
  const [markdown, setMarkdown] = useState('');

  const handleChange = debounce((editor: IEditor) => {
    const markdownContent = editor.getDocument('markdown') as unknown as string;
    const jsonContent = editor.getDocument('json') as unknown as Record<string, any>;
    setMarkdown(markdownContent || '');
    setJson(JSON.stringify(jsonContent || {}, null, 2));
  }, 300);

  const handleInit = (editor: IEditor) => {
    // @ts-expect-error for debugging
    window.editor = editor;
    handleChange(editor);
  };

  return (
    <Container json={json} markdown={markdown}>
      <Editor
        content=""
        editor={editor}
        onChange={handleChange}
        onInit={handleInit}
        pasteAsPlainText
        placeholder={'Paste some rich text here to test...'}
        type="text"
        variant="chat"
      />
    </Container>
  );
};

export default Demo;
