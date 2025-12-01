import {
  IEditor,
  INSERT_CODEINLINE_COMMAND,
  INSERT_FILE_COMMAND,
  INSERT_HEADING_COMMAND,
  INSERT_HORIZONTAL_RULE_COMMAND,
  INSERT_LINK_COMMAND,
  INSERT_MATH_COMMAND,
  INSERT_MENTION_COMMAND,
  INSERT_TABLE_COMMAND,
  ReactAutoCompletePlugin,
  ReactCodePlugin,
  ReactCodeblockPlugin,
  ReactFilePlugin,
  ReactHRPlugin,
  ReactImagePlugin,
  ReactLinkPlugin,
  ReactListPlugin,
  ReactMathPlugin,
  ReactTablePlugin,
  ReactToolbarPlugin,
  type SlashOptions,
} from '@lobehub/editor';
import { Editor, useEditor } from '@lobehub/editor/react';
import { Avatar, type CollapseProps, Text } from '@lobehub/ui';
import { debounce } from 'lodash-es';
import {
  Heading1Icon,
  Heading2Icon,
  Heading3Icon,
  MinusIcon,
  SigmaIcon,
  Table2Icon,
} from 'lucide-react';
import { memo, useMemo, useState } from 'react';

import { devConsole } from '@/utils/debug';

import Container from './Container';
import Toolbar from './Toolbar';
import { openFileSelector } from './actions';
import content from './data.json';

const Demo = memo<Pick<CollapseProps, 'collapsible' | 'defaultActiveKey'>>((props) => {
  const editor = useEditor();
  const [json, setJson] = useState('');
  const [markdown, setMarkdown] = useState('');

  const handleChange = debounce((editor: IEditor) => {
    const markdownContent = editor.getDocument('markdown') as unknown as string;
    const jsonContent = editor.getDocument('json') as unknown as Record<string, any>;
    setMarkdown(markdownContent || '');
    setJson(JSON.stringify(jsonContent || {}, null, 2));
  }, 200);

  const handleInit = (editor: IEditor) => {
    // @ts-expect-error not error：
    window.editor = editor;
    handleChange(editor);
  };

  const mentionItems: SlashOptions['items'] = useMemo(
    () => [
      {
        icon: <Avatar avatar={'💻'} size={24} />,
        key: 'bot1',
        label: '前端研发专家',
        metadata: { id: 'bot1' },
      },
      {
        icon: <Avatar avatar={'🌍'} size={24} />,
        key: 'bot2',
        label: '中英文互译助手',
        metadata: { id: 'bot2' },
      },
      {
        icon: <Avatar avatar={'📖'} size={24} />,
        key: 'bot3',
        label: '学术写作增强专家',
        metadata: { id: 'bot3' },
      },
    ],
    [],
  );

  const slashItems: SlashOptions['items'] = useMemo(() => {
    const data: SlashOptions['items'] = [
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
        icon: SigmaIcon,
        key: 'tex',
        label: 'Tex',
        onSelect: (editor) => {
          editor.dispatchCommand(INSERT_MATH_COMMAND, { code: 'x^2 + y^2 = z^2' });
          queueMicrotask(() => {
            editor.focus();
          });
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
        key: 'insert-codeInline',
        label: 'InsertCodeInline',
        onSelect: (editor) => {
          editor.dispatchCommand(INSERT_CODEINLINE_COMMAND, undefined);
          queueMicrotask(() => {
            editor.focus();
          });
        },
      },
    ];
    return data.map((item) => {
      if (item.type === 'divider') return item;
      return {
        ...item,
        extra: (
          <Text code fontSize={12} type={'secondary'}>
            {item.key}
          </Text>
        ),
      };
    });
  }, []);

  return (
    <Container json={json} markdown={markdown} {...props}>
      <Toolbar editor={editor} />
      <Editor
        content={content}
        editor={editor}
        lineEmptyPlaceholder={'Start typing here...'}
        mentionOption={{
          items: mentionItems,
          markdownWriter: (mention) => {
            return `\n<mention>${mention.label}[${mention.metadata?.id || mention.label}]</mention>\n`;
          },
          onSelect: (editor, option) => {
            editor.dispatchCommand(INSERT_MENTION_COMMAND, {
              label: String(option.label),
              metadata: { id: option.key },
            });
          },
          searchKeys: ['label'],
        }}
        onInit={handleInit}
        onTextChange={handleChange}
        placeholder={'Type something...'}
        plugins={[
          ReactListPlugin,
          ReactLinkPlugin,
          ReactCodeblockPlugin,
          ReactHRPlugin,
          ReactTablePlugin,
          ReactMathPlugin,
          ReactCodePlugin,
          Editor.withProps(ReactToolbarPlugin, {
            children: <Toolbar editor={editor} floating />,
          }),
          Editor.withProps(ReactAutoCompletePlugin, {
            delay: 1000,
            onAutoComplete: async ({ input, afterText, selectionType, abortSignal }) => {
              // Simple example: return a fixed string for demonstration
              console.log('Auto-complete triggered:', {
                afterText,
                input,
                selectionType,
              });
              const res = await fetch(`${location.origin}/nodeserver/completion`, {
                body: JSON.stringify({
                  prompt: `Please complete the following text:\n\n${input}`,
                }),
                headers: {
                  'Content-Type': 'application/json',
                },
                method: 'POST',
                signal: abortSignal,
              });
              if (abortSignal.aborted) {
                console.log('Auto-complete aborted');
                return null;
              }
              const ai = await res.json();
              if (ai) {
                if (ai.content.startsWith(input)) {
                  return ai.content.replace(input, '');
                }
                return ai.content;
              }
              return null;
            },
          }),
          Editor.withProps(ReactImagePlugin, {
            defaultBlockImage: true,
          }),
          Editor.withProps(ReactFilePlugin, {
            handleUpload: async (file) => {
              devConsole.log('Files uploaded:', file);
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
          items: slashItems,
        }}
      />
    </Container>
  );
});

export default Demo;
