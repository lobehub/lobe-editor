import {
  IEditor,
  INSERT_CODEINLINE_COMMAND,
  INSERT_HEADING_COMMAND,
  INSERT_HORIZONTAL_RULE_COMMAND,
  INSERT_LINK_COMMAND,
  INSERT_MATH_COMMAND,
  INSERT_MENTION_COMMAND,
  INSERT_TABLE_COMMAND,
  ReactCodePlugin,
  ReactCodeblockPlugin,
  ReactHRPlugin,
  ReactImagePlugin,
  ReactLinkPlugin,
  ReactListPlugin,
  ReactMathPlugin,
  ReactTablePlugin,
} from '@lobehub/editor';
import { Editor } from '@lobehub/editor/react';
import { Avatar, type CollapseProps } from '@lobehub/ui';
import { debounce } from 'lodash-es';
import { Heading1Icon, Heading2Icon, Heading3Icon, MinusIcon, Table2Icon } from 'lucide-react';
import { memo, useEffect, useState } from 'react';

import { INSERT_FILE_COMMAND, ReactFilePlugin } from '@/plugins/file';

import Container from './Container';
import Toolbar from './Toolbar';
import { openFileSelector } from './actions';
import content from './data.json';

const Demo = memo<Pick<CollapseProps, 'collapsible' | 'defaultActiveKey'>>((props) => {
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
    <Container json={json} markdown={markdown} {...props}>
      <Toolbar editorRef={editorRef} />
      <Editor
        content={content}
        editorRef={editorRef}
        mentionOption={{
          items: async (search) => {
            console.log(search);
            const data = [
              {
                icon: <Avatar avatar={'💻'} size={24} />,
                key: 'bot1',
                label: '前端研发专家',
              },
              {
                icon: <Avatar avatar={'🌍'} size={24} />,
                key: 'bot2',
                label: '中英文互译助手',
              },
              {
                icon: <Avatar avatar={'📖'} size={24} />,
                key: 'bot3',
                label: '学术写作增强专家',
              },
            ];
            if (!search?.matchingString) return data;
            return data.filter((item) => {
              if (!item.label) return true;
              return item.label.toLowerCase().includes(search.matchingString.toLowerCase());
            });
          },
          markdownWriter: (mention) => {
            return `\n<mention>${mention.label}[${mention.extra.id}]</mention>\n`;
          },
          onSelect: (editor, option) => {
            editor.dispatchCommand(INSERT_MENTION_COMMAND, {
              label: String(option.label),
            });
          },
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
          ReactMathPlugin,
          ReactCodePlugin,
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
             * Custom file markdown output
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
            {
              key: 'insert-mathinline',
              label: 'InsertMathInline',
              onSelect: (editor) => {
                editor.dispatchCommand(INSERT_MATH_COMMAND, { code: 'x^2 + y^2 = z^2' });
                queueMicrotask(() => {
                  editor.focus();
                });
              },
            },
            {
              key: 'insert-codeInline',
              label: 'InsertCodeInline',
              onSelect: (editor) => {
                editor.dispatchCommand(INSERT_CODEINLINE_COMMAND, {});
                queueMicrotask(() => {
                  editor.focus();
                });
              },
            },
          ],
        }}
      />
    </Container>
  );
});

export default Demo;
