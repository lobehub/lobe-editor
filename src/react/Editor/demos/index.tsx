import {
  IEditor,
  INSERT_CODEINLINE_COMMAND,
  INSERT_CODEMIRROR_COMMAND,
  INSERT_FILE_COMMAND,
  INSERT_HEADING_COMMAND,
  INSERT_HORIZONTAL_RULE_COMMAND,
  INSERT_LINK_COMMAND,
  INSERT_MATH_COMMAND,
  INSERT_MENTION_COMMAND,
  INSERT_TABLE_COMMAND,
  type LinkEmbedRule,
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
  type SchemaRule,
  type SlashOptions,
  scrollIntoView,
} from '@lobehub/editor';
import { Editor, useEditor } from '@lobehub/editor/react';
import { Avatar, type CollapseProps, Text } from '@lobehub/ui';
import { createStaticStyles } from 'antd-style';
import { debounce } from 'es-toolkit';
import {
  Heading1Icon,
  Heading2Icon,
  Heading3Icon,
  MinusIcon,
  SigmaIcon,
  Table2Icon,
} from 'lucide-react';
import { type FC, useMemo, useState } from 'react';

import linkDemoContent from '@/plugins/link/demos/data.json';
import { devConsole } from '@/utils/debug';

import Container from './Container';
import Toolbar from './Toolbar';
import { openFileSelector } from './actions';
import content from './data.json';

// @ts-expect-error not error
window.__scrollIntoView = scrollIntoView;

const styles = createStaticStyles(({ css, cssVar }) => ({
  editor: css`
    padding: 16px;
  `,
  linkCard: css`
    display: inline-flex;
    gap: 4px;
    align-items: center;

    max-width: min(320px, 100%);
    padding-block: 0;
    padding-inline: 2px;

    line-height: 1;
    color: ${cssVar.colorLink};
    text-decoration: none;
    vertical-align: baseline;

    &[data-selected='true'] {
      border-radius: 5px;
      outline: 2px solid ${cssVar.colorPrimaryBorder};
      outline-offset: 1px;
    }

    &:hover {
      color: ${cssVar.colorLinkHover};
      text-decoration: none;
    }
  `,
  linkCardIcon: css`
    position: relative;
    inset-block-start: 0.06em;

    overflow: hidden;
    display: grid;
    flex: none;
    place-items: center;

    width: 1.1em;
    height: 1.1em;
    border-radius: 5px;

    font-size: 11px;
    line-height: 1;
    color: ${cssVar.colorTextSecondary};

    background: ${cssVar.colorFillQuaternary};

    img {
      display: block;
      width: 100%;
      height: 100%;
      object-fit: cover;
    }
  `,
  linkCardTitle: css`
    overflow: hidden;
    display: inline-block;

    min-width: 0;

    line-height: 1;
    text-overflow: ellipsis;
    white-space: nowrap;
  `,
  linkIframe: css`
    position: relative;

    overflow: hidden;

    width: 100%;
    border: 1px solid ${cssVar.colorBorderSecondary};
    border-radius: 8px;

    &[data-selected='true'],
    &:focus,
    &:focus-within {
      border-color: ${cssVar.colorPrimary};
      outline: none;
      box-shadow: 0 0 0 2px ${cssVar.colorPrimaryBg};
    }
  `,
  linkIframeLoading: css`
    display: flex;
    gap: 8px;
    align-items: center;
    justify-content: center;

    height: 320px;

    font-size: 13px;
    color: ${cssVar.colorTextSecondary};

    background: ${cssVar.colorFillQuaternary};
  `,
  linkIframeSpinner: css`
    width: 14px;
    height: 14px;
    border: 2px solid ${cssVar.colorBorderSecondary};
    border-block-start-color: ${cssVar.colorPrimary};
    border-radius: 50%;

    animation: lobe-link-iframe-spin 1s linear infinite;

    @keyframes lobe-link-iframe-spin {
      to {
        transform: rotate(360deg);
      }
    }
  `,
  linkIframeTitle: css`
    padding-block: 8px;
    padding-inline: 10px;
    border-block-end: 1px solid ${cssVar.colorBorderSecondary};

    font-size: 12px;
    color: ${cssVar.colorTextSecondary};
  `,
  schemaLink: css`
    display: inline-grid;
    gap: 4px;

    padding-block: 8px;
    padding-inline: 10px;
    border: 1px solid ${cssVar.colorBorderSecondary};
    border-radius: 8px;

    background: ${cssVar.colorFillQuaternary};
  `,
}));

const amapIcon =
  'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 48 48%22%3E%3Crect width=%2248%22 height=%2248%22 rx=%2210%22 fill=%22%23f6fbff%22/%3E%3Cpath d=%22M8 24 40 8 27 40l-5-13-14-3Z%22 fill=%22%231677ff%22/%3E%3Cpath d=%22m22 27 18-19-13 32-5-13Z%22 fill=%22%2300b96b%22 opacity=%22.82%22/%3E%3Cpath d=%22M8 24 40 8 19 29l3-2-14-3Z%22 fill=%22%2369c0ff%22/%3E%3C/svg%3E';

const amapRule: LinkEmbedRule = {
  allowCard: true,
  allowIframe: true,
  getCardPayload: (url) => ({
    icon: amapIcon,
    title: '高德地图',
    url,
  }),
  getIframePayload: (url) => ({
    src: url,
    title: 'Amap embed',
    url,
  }),
  id: 'amap-share',
  match: (url) => /(^https?:\/\/)?(uri\.amap\.com|amap\.com)\//.test(url),
};

const genericWebRule: LinkEmbedRule = {
  allowCard: true,
  allowIframe: true,
  getCardPayload: (url, context) => ({
    title: context.title || url,
    url,
  }),
  id: 'generic-web',
  match: (url) => /^https?:\/\//.test(url),
};

const schemaRules: SchemaRule[] = [
  {
    id: 'schema-card',
    match: (url) => url.startsWith('schema://'),
    parse: (url, schema) => ({
      payload: schema,
      schemaType: schema?.host || 'schema',
      title: `Schema ${schema?.pathname || url}`,
      url,
    }),
  },
  {
    id: 'alipay',
    match: (url) => url.startsWith('alipay://'),
    parse: (url, schema) => ({
      payload: schema,
      schemaType: 'alipay',
      title: 'Alipay schema action',
      url,
    }),
  },
];

const homeContent = {
  root: {
    ...content.root,
    children: [...linkDemoContent.root.children, ...content.root.children],
  },
};

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
      {
        key: 'insert-codeBlock',
        label: 'InsertCodeBlock',
        onSelect: (editor) => {
          editor.dispatchCommand(INSERT_CODEMIRROR_COMMAND, undefined);
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
        content={homeContent}
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
          Editor.withProps(ReactLinkPlugin, {
            allowedProtocols: ['schema:', 'alipay:'],
            labels: {
              convertToCard: 'Card',
              convertToIframe: 'Iframe',
              convertToLink: 'Link',
              convertToSchema: 'Schema',
            },
            linkEmbedRules: [amapRule, genericWebRule],
            renderLinkCard: ({
              icon,
              isSelected,
              onClickCapture,
              onMouseDownCapture,
              openTarget,
              title,
              url,
            }) => (
              <a
                className={styles.linkCard}
                data-selected={isSelected}
                href={url}
                onClickCapture={onClickCapture}
                onMouseDownCapture={onMouseDownCapture}
                rel="noreferrer"
                target={openTarget || '_blank'}
              >
                <span aria-hidden className={styles.linkCardIcon}>
                  {icon ? <img alt="" src={icon} /> : title.slice(0, 1).toUpperCase()}
                </span>
                <span className={styles.linkCardTitle}>{title}</span>
              </a>
            ),
            renderLinkIframe: ({
              isLoading,
              isSelected,
              onLoad,
              onMouseDownCapture,
              src,
              title,
            }) => (
              <div className={styles.linkIframe} data-selected={isSelected} tabIndex={0}>
                <div className={styles.linkIframeTitle} onMouseDownCapture={onMouseDownCapture}>
                  {title}
                </div>
                {isLoading && (
                  <div className={styles.linkIframeLoading}>
                    <span className={styles.linkIframeSpinner} />
                    Loading embed...
                  </div>
                )}
                <iframe
                  height={320}
                  onLoad={onLoad}
                  src={src}
                  style={{ border: 0, display: isLoading ? 'none' : 'block', width: '100%' }}
                  title={title}
                />
              </div>
            ),
            renderSchema: ({ payload, schema, schemaType, title, url }) => (
              <div className={styles.schemaLink}>
                <strong>{title}</strong>
                <span>{schemaType}</span>
                <code>{schema?.protocol || url}</code>
                <small>{JSON.stringify(payload)}</small>
              </div>
            ),
            schemaRules,
          }),
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
