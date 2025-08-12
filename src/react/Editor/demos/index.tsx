import {
  IEditor,
  INSERT_HEADING_COMMAND,
  INSERT_HORIZONTAL_RULE_COMMAND,
  INSERT_LINK_COMMAND,
  INSERT_MENTION_COMMAND,
  INSERT_QUOTE_COMMAND,
  INSERT_TABLE_COMMAND,
  ReactCodeblockPlugin,
  ReactHRPlugin,
  ReactImagePlugin,
  ReactLinkPlugin,
  ReactListPlugin,
  ReactMentionPlugin,
  ReactTablePlugin,
} from '@lobehub/editor';
import { Editor } from '@lobehub/editor/react';
import { Icon } from '@lobehub/ui';
import * as LucideIcon from 'lucide-react';
import { useEffect, useState } from 'react';

import { INSERT_FILE_COMMAND, ReactFilePlugin } from '@/plugins/file';

import Container from './Container';
import { openFileSelector } from './actions';
import content from './data.json';
import Toolbar from './toolbar';

export default () => {
  const editorRef = Editor.useEditor();
  const [json, setJson] = useState('');
  const [markdown, setMarkdown] = useState('');

  const handleChange = (editor: IEditor) => {
    const markdownContent = editor.getDocument('markdown') as unknown as string;
    const jsonContent = editor.getDocument('json') as unknown as Record<string, any>;
    setMarkdown(markdownContent || '');
    setJson(JSON.stringify(jsonContent || {}, null, 2));
  };

  useEffect(() => {
    if (!editorRef.current) return;
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
                label: (
                  <div>
                    <Icon icon={LucideIcon.NotebookIcon} />
                    {search?.matchingString} - {search?.replaceableString}
                  </div>
                ),
                onSelect: (editor) => {
                  editor.dispatchCommand(INSERT_MENTION_COMMAND, { extra: { id: 1 }, label: 'XX' });
                },
                value: 'XX',
              },
            ];
          },
          maxLength: 6,
        }}
        onChange={handleChange}
        placeholder={'Type something...'}
        plugins={[
          ReactListPlugin,
          ReactLinkPlugin,
          ReactImagePlugin,
          Editor.withProps(ReactCodeblockPlugin, { shikiTheme: 'dark-plus' }),
          ReactHRPlugin,
          ReactTablePlugin,
          Editor.withProps(ReactMentionPlugin, {
            /**
             * 自定义 mention markdown 输出
             */
            markdownWriter: (mention) => {
              return `\n<mention>${mention.label}[${mention.extra.id}]</mention>\n`;
            },
          }),
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
            {
              label: 'Quote',
              onSelect: (editor) => {
                editor.dispatchCommand(INSERT_QUOTE_COMMAND, {});
              },
              value: 'quote',
            },
            {
              label: 'H1',
              onSelect: (editor) => {
                editor.dispatchCommand(INSERT_HEADING_COMMAND, { tag: 'h1' });
              },
              value: 'h1',
            },
            {
              label: 'H2',
              onSelect: (editor) => {
                editor.dispatchCommand(INSERT_HEADING_COMMAND, { tag: 'h2' });
              },
              value: 'h2',
            },
            {
              label: 'HR',
              onSelect: (editor) => {
                editor.dispatchCommand(INSERT_HORIZONTAL_RULE_COMMAND, {});
              },
              value: 'hr',
            },
          ],
        }}
      />
    </Container>
  );
};
