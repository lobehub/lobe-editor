import {
  IEditor,
  INSERT_LINK_COMMAND,
  INSERT_TABLE_COMMAND,
  ReactCodeblockPlugin,
  ReactHRPlugin,
  ReactImagePlugin,
  ReactLinkPlugin,
  ReactListPlugin,
  ReactTablePlugin,
} from '@lobehub/editor';
import { Editor } from '@lobehub/editor/react';
import { useEffect, useState } from 'react';

import { INSERT_FILE_COMMAND, ReactFilePlugin } from '@/plugins/file';

import Container from './Container';
import { openFileSelector } from './actions';
import content from './data.json';

export default () => {
  const editorRef = Editor.useEditor();
  const [json, setJson] = useState('');
  const [text, setText] = useState('');

  const handleChange = (editor: IEditor) => {
    const textContent = editor.getDocument('text') as unknown as string;
    const jsonContent = editor.getDocument('json') as unknown as Record<string, any>;
    setText(textContent || '');
    setJson(JSON.stringify(jsonContent || {}, null, 2));
    console.log('Editor content changed:', editor.getDocument('text'));
    console.log('Editor content changed:', editor.getDocument('json'));
  };

  useEffect(() => {
    if (!editorRef.current) return;
    handleChange(editorRef.current);
  }, []);

  return (
    <Container json={json} text={text}>
      <Editor
        content={content}
        editorRef={editorRef}
        mentionOption={{
          items: [
            {
              label: 'XX',
              value: 'XX',
            },
          ],
        }}
        onChange={handleChange}
        placeholder={'Type something...'}
        plugins={[
          ReactListPlugin,
          ReactLinkPlugin,
          ReactImagePlugin,
          ReactCodeblockPlugin,
          ReactHRPlugin,
          ReactTablePlugin,
          Editor.withProps(ReactFilePlugin, {
            handleUpload: async (file) => {
              console.log('Files uploaded:', file);
              return new Promise((resolve) => {
                setTimeout(() => {
                  resolve({ url: URL.createObjectURL(file) });
                }, 1000);
              });
            },
          }),
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
            {
              label: 'File',
              onSelect: (editor) => {
                openFileSelector((files) => {
                  for (const file of files) {
                    editor.dispatchCommand(INSERT_FILE_COMMAND, { file });
                  }
                });
              },
              value: 'file',
            },
            {
              label: 'SetTextContent',
              onSelect: (editor) => {
                editor.setDocument('text', '123\n123');
                queueMicrotask(() => {
                  editor.focus();
                });
              },
              value: 'set-text-content',
            },
            {
              label: 'InsertLink',
              onSelect: (editor) => {
                editor.dispatchCommand(INSERT_LINK_COMMAND, { url: 'https://example.com' });
                queueMicrotask(() => {
                  editor.focus();
                });
              },
              value: 'insert-link',
            },
          ],
        }}
      />
    </Container>
  );
};
