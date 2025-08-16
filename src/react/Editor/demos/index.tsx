import {
  IEditor,
  INSERT_HEADING_COMMAND,
  INSERT_HORIZONTAL_RULE_COMMAND,
  INSERT_LINK_COMMAND,
  INSERT_MENTION_COMMAND,
  INSERT_TABLE_COMMAND,
  ReactCodeblockPlugin,
  ReactHRPlugin,
  ReactImagePlugin,
  ReactLinkPlugin,
  ReactListPlugin,
  ReactTablePlugin,
} from '@lobehub/editor';
import { Editor } from '@lobehub/editor/react';
import { debounce } from 'lodash';
import { Heading1Icon, Heading2Icon, Heading3Icon, MinusIcon, Table2Icon } from 'lucide-react';
import { useEffect, useState } from 'react';

import { INSERT_FILE_COMMAND, ReactFilePlugin } from '@/plugins/file';

import Container from './Container';
import Toolbar from './Toolbar';
import { openFileSelector } from './actions';
import content from './data.json';

export default () => {
  const editorRef = Editor.useEditor();
  const [json, setJson] = useState('');
  const [markdown, setMarkdown] = useState('');

  const handleChange = debounce((editor: IEditor) => {
    const markdownContent = editor.getDocument('markdown') as unknown as string;
    const jsonContent = editor.getDocument('json') as unknown as Record<string, any>;
    setMarkdown(markdownContent || '');
    setJson(JSON.stringify(jsonContent || {}, null, 2));
  }, 300);

  useEffect(() => {
    if (!editorRef.current) return;
    // @ts-expect-error not error：
    window.editor = editorRef.current;
    handleChange(editorRef.current);
  }, []);

  return (
    <Container json={json} markdown={markdown}>
      <Toolbar editorRef={editorRef} />
      <Editor
        content={content}
        editorRef={editorRef}
        mentionOption={{
          items: async (search) => {
            await new Promise((resolve) => {
              setTimeout(() => resolve(true), 1000);
            });
            return [
              {
                key: 'XX',
                label: `${search?.matchingString} - ${search?.replaceableString}`,
                onSelect: (editor) => {
                  editor.dispatchCommand(INSERT_MENTION_COMMAND, { extra: { id: 1 }, label: 'XX' });
                },
              },
            ];
          },
          markdownWriter: (mention) => {
            return `\n<mention>${mention.label}[${mention.extra.id}]</mention>\n`;
          },
          maxLength: 6,
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
            /**
             * 自定义 file markdown 输出
             */
            markdownWriter: (file) => {
              return `\n<file>${file.fileUrl}</file>\n`;
            },
          }),
        ]}
        slashOption={{
          items: [
            {
              icon: Heading1Icon,
              key: 'h1',
              label: 'Heading 1',
              onSelect: (editor) => {
                editor.dispatchCommand(INSERT_HEADING_COMMAND, { tag: 'h1' });
              },
            },
            {
              icon: Heading2Icon,
              key: 'h2',
              label: 'Heading 2',
              onSelect: (editor) => {
                editor.dispatchCommand(INSERT_HEADING_COMMAND, { tag: 'h2' });
              },
            },
            {
              icon: Heading3Icon,
              key: 'h3',
              label: 'Heading 3',
              onSelect: (editor) => {
                editor.dispatchCommand(INSERT_HEADING_COMMAND, { tag: 'h3' });
              },
            },

            {
              type: 'divider',
            },
            {
              icon: MinusIcon,
              key: 'hr',
              label: 'Hr',
              onSelect: (editor) => {
                editor.dispatchCommand(INSERT_HORIZONTAL_RULE_COMMAND, {});
              },
            },
            {
              icon: Table2Icon,
              key: 'table',
              label: 'Table',
              onSelect: (editor) => {
                editor.dispatchCommand(INSERT_TABLE_COMMAND, { columns: '3', rows: '3' });
              },
            },
            {
              type: 'divider',
            },
            {
              key: 'file',
              label: 'File',
              onSelect: (editor) => {
                openFileSelector((files) => {
                  for (const file of files) {
                    editor.dispatchCommand(INSERT_FILE_COMMAND, { file });
                  }
                });
              },
            },
            {
              key: 'set-text-content',
              label: 'SetTextContent',
              onSelect: (editor) => {
                editor.setDocument('text', '123\n123');
                queueMicrotask(() => {
                  editor.focus();
                });
              },
            },
            {
              key: 'insert-link',
              label: 'InsertLink',
              onSelect: (editor) => {
                editor.dispatchCommand(INSERT_LINK_COMMAND, { url: 'https://example.com' });
                queueMicrotask(() => {
                  editor.focus();
                });
              },
            },
          ],
          maxLength: 6,
        }}
      />
    </Container>
  );
};
