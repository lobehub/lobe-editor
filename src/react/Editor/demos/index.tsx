import {
  IEditor,
  INSERT_CHECK_LIST_COMMAND,
  INSERT_CODEINLINE_COMMAND,
  INSERT_CODEMIRROR_COMMAND,
  INSERT_FILE_COMMAND,
  INSERT_HEADING_COMMAND,
  INSERT_HORIZONTAL_RULE_COMMAND,
  INSERT_IMAGE_COMMAND,
  INSERT_LINK_COMMAND,
  INSERT_MATH_COMMAND,
  INSERT_MENTION_COMMAND,
  INSERT_ORDERED_LIST_COMMAND,
  INSERT_QUOTE_COMMAND,
  INSERT_TABLE_COMMAND,
  INSERT_UNORDERED_LIST_COMMAND,
  ReactAutoCompletePlugin,
  ReactBlockPlugin,
  ReactCodePlugin,
  ReactCodemirrorPlugin,
  ReactFilePlugin,
  ReactHRPlugin,
  ReactImagePlugin,
  ReactLinkPlugin,
  ReactListPlugin,
  ReactLiteXmlPlugin,
  ReactMathPlugin,
  ReactTablePlugin,
  ReactToolbarPlugin,
  ReactVirtualBlockPlugin,
  type SlashOptions,
  scrollIntoView,
} from '@lobehub/editor';
import { Editor, useEditor } from '@lobehub/editor/react';
import { Avatar, type CollapseProps, Text } from '@lobehub/ui';
import { createStaticStyles } from 'antd-style';
import { debounce } from 'es-toolkit';
import {
  BracesIcon,
  Code2Icon,
  FileIcon,
  Heading1Icon,
  Heading2Icon,
  Heading3Icon,
  Heading4Icon,
  Heading5Icon,
  ImageIcon,
  LinkIcon,
  ListChecksIcon,
  ListIcon,
  ListOrderedIcon,
  MinusIcon,
  PanelTopIcon,
  QuoteIcon,
  SigmaIcon,
  Table2Icon,
  TagIcon,
  TypeIcon,
} from 'lucide-react';
import { type FC, useMemo, useState } from 'react';

import { devConsole } from '@/utils/debug';

import Container from './Container';
import Toolbar from './Toolbar';
import { openFileSelector } from './actions';
import content from './data.json';

// @ts-expect-error not error
window.__scrollIntoView = scrollIntoView;

const styles = createStaticStyles(({ css }) => ({
  editor: css`
    padding: 16px;
  `,
}));

const Demo: FC<Pick<CollapseProps, 'collapsible' | 'defaultActiveKey'>> = (props) => {
  const editor = useEditor();
  const [json, setJson] = useState('');
  const [markdown, setMarkdown] = useState('');
  const [xml, setXml] = useState('');

  const handleChange = useMemo(
    () =>
      debounce((editor: IEditor) => {
        const markdownContent = editor.getDocument('markdown') as unknown as string;
        const jsonContent = editor.getDocument('json') as unknown as Record<string, any>;
        const xmlContent = editor.getDocument('litexml') as unknown as string;
        setMarkdown(markdownContent || '');
        setJson(JSON.stringify(jsonContent || {}, null, 2));
        setXml(xmlContent || '');
      }, 200),
    [],
  );

  const handleJSONChange = useMemo(
    () =>
      debounce((value: any) => {
        if (editor) {
          console.info('handleJSONChange', value);
          editor.setDocument('json', value);
        }
      }, 200),
    [],
  );

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
        layout: 'compact',
        onSelect: (editor) => {
          editor.dispatchCommand(INSERT_HEADING_COMMAND, { tag: 'h1' });
        },
        shortcut: 'h1',
      },
      {
        icon: Heading2Icon,
        key: 'h2',
        label: 'Heading 2',
        layout: 'compact',
        onSelect: (editor) => {
          editor.dispatchCommand(INSERT_HEADING_COMMAND, { tag: 'h2' });
        },
        shortcut: 'h2',
      },
      {
        icon: Heading3Icon,
        key: 'h3',
        label: 'Heading 3',
        layout: 'compact',
        onSelect: (editor) => {
          editor.dispatchCommand(INSERT_HEADING_COMMAND, { tag: 'h3' });
        },
        shortcut: 'h3',
      },
      {
        icon: Heading4Icon,
        key: 'h4',
        label: 'Heading 4',
        layout: 'compact',
        onSelect: (editor) => {
          editor.dispatchCommand(INSERT_HEADING_COMMAND, { tag: 'h4' });
        },
        shortcut: 'h4',
      },
      {
        icon: Heading5Icon,
        key: 'h5',
        label: 'Heading 5',
        layout: 'compact',
        onSelect: (editor) => {
          editor.dispatchCommand(INSERT_HEADING_COMMAND, { tag: 'h5' });
        },
        shortcut: 'h5',
      },
      {
        icon: TypeIcon,
        key: 'paragraph',
        label: 'Paragraph',
        layout: 'compact',
        shortcut: 'text',
      },
      {
        icon: QuoteIcon,
        key: 'quote',
        label: 'Quote',
        layout: 'compact',
        onSelect: (editor) => {
          editor.dispatchCommand(INSERT_QUOTE_COMMAND, {});
        },
        shortcut: 'quote',
      },
      {
        icon: ListIcon,
        key: 'bullet-list',
        label: 'Bullet List',
        layout: 'compact',
        onSelect: (editor) => {
          editor.dispatchCommand(INSERT_UNORDERED_LIST_COMMAND, undefined);
        },
        shortcut: 'ul',
      },
      {
        icon: ListOrderedIcon,
        key: 'numbered-list',
        label: 'Numbered List',
        layout: 'compact',
        onSelect: (editor) => {
          editor.dispatchCommand(INSERT_ORDERED_LIST_COMMAND, undefined);
        },
        shortcut: 'ol',
      },
      {
        icon: ListChecksIcon,
        key: 'todo-list',
        label: 'Todo List',
        layout: 'compact',
        onSelect: (editor) => {
          editor.dispatchCommand(INSERT_CHECK_LIST_COMMAND, undefined);
        },
        shortcut: 'todo',
      },
      {
        icon: LinkIcon,
        key: 'quick-link',
        label: 'Link',
        layout: 'compact',
        onSelect: (editor) => {
          editor.dispatchCommand(INSERT_LINK_COMMAND, { url: 'https://example.com' });
        },
        shortcut: 'link',
      },
      {
        icon: Code2Icon,
        key: 'quick-code',
        label: 'Code',
        layout: 'compact',
        onSelect: (editor) => {
          editor.dispatchCommand(INSERT_CODEINLINE_COMMAND, undefined);
        },
        shortcut: 'code',
      },
      {
        type: 'divider',
      },
      {
        icon: MinusIcon,
        key: 'hr',
        label: 'Hr',
        layout: 'tile',
        onSelect: (editor) => {
          editor.dispatchCommand(INSERT_HORIZONTAL_RULE_COMMAND, {});
        },
        shortcut: 'hr',
      },
      {
        icon: Table2Icon,
        key: 'table',
        label: 'Table',
        layout: 'tile',
        onSelect: (editor) => {
          editor.dispatchCommand(INSERT_TABLE_COMMAND, { columns: '3', rows: '3' });
        },
        shortcut: 'table',
      },
      {
        icon: SigmaIcon,
        key: 'tex',
        label: 'Tex',
        layout: 'tile',
        onSelect: (editor) => {
          editor.dispatchCommand(INSERT_MATH_COMMAND, { code: 'x^2 + y^2 = z^2' });
          queueMicrotask(() => {
            editor.focus();
          });
        },
        shortcut: 'tex',
      },
      {
        icon: ImageIcon,
        key: 'image',
        label: 'Image',
        layout: 'tile',
        onSelect: (editor) => {
          openFileSelector((files) => {
            const [file] = files;
            if (file) {
              editor.dispatchCommand(INSERT_IMAGE_COMMAND, { file });
            }
          });
        },
        shortcut: 'image',
      },
      {
        type: 'divider',
      },
      {
        icon: FileIcon,
        key: 'file',
        label: 'File',
        layout: 'tile',
        onSelect: (editor) => {
          openFileSelector((files) => {
            for (const file of files) {
              editor.dispatchCommand(INSERT_FILE_COMMAND, { file });
            }
          });
        },
        shortcut: 'file',
      },
      {
        icon: TagIcon,
        key: 'status',
        label: 'Status',
        layout: 'tile',
        shortcut: 'status',
      },
      {
        icon: PanelTopIcon,
        key: 'set-text-content',
        label: 'SetTextContent',
        layout: 'wide',
        onSelect: (editor) => {
          editor.setDocument('text', '123\n123');
          queueMicrotask(() => {
            editor.focus();
          });
        },
        shortcut: 'set-text',
      },
      {
        icon: LinkIcon,
        key: 'insert-link',
        label: 'InsertLink',
        layout: 'wide',
        onSelect: (editor) => {
          editor.dispatchCommand(INSERT_LINK_COMMAND, { url: 'https://example.com' });
          queueMicrotask(() => {
            editor.focus();
          });
        },
        shortcut: 'link',
      },

      {
        icon: Code2Icon,
        key: 'insert-codeInline',
        label: 'InsertCodeInline',
        layout: 'wide',
        onSelect: (editor) => {
          editor.dispatchCommand(INSERT_CODEINLINE_COMMAND, undefined);
          queueMicrotask(() => {
            editor.focus();
          });
        },
        shortcut: 'code',
      },
      {
        icon: BracesIcon,
        key: 'insert-codeBlock',
        label: 'InsertCodeBlock',
        layout: 'wide',
        onSelect: (editor) => {
          editor.dispatchCommand(INSERT_CODEMIRROR_COMMAND, undefined);
          queueMicrotask(() => {
            editor.focus();
          });
        },
        shortcut: 'codeblock',
      },
    ];
    return data.map((item) => {
      if (item.type === 'divider') return item;
      return {
        ...item,
        shortcut: (
          <Text code fontSize={12} type={'secondary'}>
            {item.shortcut ?? item.key}
          </Text>
        ),
      };
    });
  }, []);

  return (
    <Container
      editor={editor}
      json={json}
      markdown={markdown}
      onJSONChange={handleJSONChange}
      shouldShowXml
      xml={xml}
      {...props}
    >
      <Toolbar editor={editor} />
      <Editor
        className={styles.editor}
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
        pasteVSCodeAsCodeBlock
        placeholder={'Type something...'}
        plugins={[
          ReactLiteXmlPlugin,
          ReactBlockPlugin,
          ReactListPlugin,
          ReactLinkPlugin,
          ReactImagePlugin,
          // ReactCodeblockPlugin,
          ReactVirtualBlockPlugin,
          ReactCodemirrorPlugin,
          ReactHRPlugin,
          ReactTablePlugin,
          ReactMathPlugin,
          ReactCodePlugin,
          Editor.withProps(ReactToolbarPlugin, {
            children: <Toolbar editor={editor} floating />,
          }),
          Editor.withProps(ReactAutoCompletePlugin, {
            delay: 1000,
            onAutoComplete: async ({
              input,
              afterText,
              selectionType,
              abortSignal,
              suggestionId,
            }) => {
              console.log('Auto-complete triggered:', {
                afterText,
                input,
                selectionType,
                suggestionId,
              });

              await new Promise((resolve) => {
                setTimeout(resolve, 1000);
              });

              if (abortSignal.aborted) {
                console.log('Auto-complete aborted:', { suggestionId });
                return null;
              }

              return ` This is the auto-completed text for "${input}".`;
            },
            onSuggestionAccepted: ({ acceptedText, suggestionId, visibleMs }) => {
              console.log('Auto-complete accepted:', {
                acceptedText,
                suggestionId,
                visibleMs,
              });
            },
            onSuggestionRejected: ({ reason, suggestionId, visibleMs }) => {
              console.log('Auto-complete rejected:', {
                reason,
                suggestionId,
                visibleMs,
              });
            },
          }),
          Editor.withProps(ReactImagePlugin, {
            defaultBlockImage: true,
            handleRehost: async (url) => {
              const res = await fetch(url);
              const blob = await res.blob();
              return await new Promise<{ url: string }>((resolve, reject) => {
                const reader = new FileReader();
                reader.onloadend = () => resolve({ url: reader.result as string });
                // eslint-disable-next-line unicorn/prefer-add-event-listener
                reader.onerror = reject;
                reader.readAsDataURL(blob);
              });
            },
            needRehost: (url) => {
              devConsole.log('needRehost', url);
              return url.startsWith('blob:');
            },
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
};

export default Demo;
