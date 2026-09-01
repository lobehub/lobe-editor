import {
  type IEditor,
  AnnotationToolbarAction,
  type AnnotationBubbleContext,
  type AnnotationComposerContext,
  INSERT_ARTIFACT_COMMAND,
  INSERT_CODEINLINE_COMMAND,
  INSERT_CODEMIRROR_COMMAND,
  INSERT_COLLAPSIBLE_COMMAND,
  INSERT_FILE_COMMAND,
  INSERT_HEADING_COMMAND,
  INSERT_HORIZONTAL_RULE_COMMAND,
  INSERT_LINK_COMMAND,
  INSERT_MATH_COMMAND,
  INSERT_MENTION_COMMAND,
  INSERT_TABLE_COMMAND,
  type LinkEmbedRule,
  ReactAutoCompletePlugin,
  ReactArtifactPlugin,
  ReactBlockPlugin,
  ReactCodePlugin,
  ReactCodemirrorPlugin,
  ReactCollapsiblePlugin,
  ReactFilePlugin,
  ReactHRPlugin,
  ReactImagePlugin,
  ReactLinkPlugin,
  ReactListPlugin,
  ReactLiteXmlPlugin,
  ReactMathPlugin,
  ReactNodePropertiesPlugin,
  ReactTablePlugin,
  ReactTocPlugin,
  ReactToolbarPlugin,
  ReactVirtualBlockPlugin,
  ReactYjsPlugin,
  type SchemaRule,
  type SlashOptions,
  type YjsProviderFactory,
  scrollIntoView,
} from '@lobehub/editor';
import { Editor, useEditor } from '@lobehub/editor/react';
import { Avatar, type CollapseProps, Text } from '@lobehub/ui';
import { Alert, Button, Input, Segmented, Space, Tag } from 'antd';
import { createStaticStyles } from 'antd-style';
import { debounce } from 'es-toolkit';
import {
  Heading1Icon,
  Heading2Icon,
  Heading3Icon,
  ListCollapseIcon,
  MessageSquareQuote,
  MinusIcon,
  PanelsTopLeftIcon,
  SigmaIcon,
  Table2Icon,
} from 'lucide-react';
import { type FC, type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react';

import linkDemoContent from '@/plugins/link/demos/data.json';
import {
  type WebSocketYjsProviderStatus,
  createWebSocketYjsProvider,
  fetchWebSocketDemoDocument,
  saveWebSocketDemoDocument,
  snapshotWebSocketDemoDocument,
} from '@/plugins/yjs/websocket-provider';
import { devConsole } from '@/utils/debug';

import { createBroadcastChannelYjsProvider } from './BroadcastChannelYjsProvider';
import Container from './Container';
import Toolbar from './Toolbar';
import { openFileSelector } from './actions';
import localContent from './data.json';

// @ts-expect-error not error
window.__scrollIntoView = scrollIntoView;

const cursorColors = ['#2563eb', '#dc2626', '#16a34a', '#9333ea', '#ea580c', '#0891b2'];

const getTabUser = () => {
  if (typeof window === 'undefined') {
    return {
      color: cursorColors[0],
      name: 'Demo user',
    };
  }

  const cacheKey = 'lobe-editor-demo-yjs-user';
  const cached = window.sessionStorage.getItem(cacheKey);

  if (cached) {
    return JSON.parse(cached) as { color: string; name: string };
  }

  const index = Math.floor(Math.random() * cursorColors.length);
  const user = {
    color: cursorColors[index],
    name: `Demo user ${Math.floor(Math.random() * 900 + 100)}`,
  };

  window.sessionStorage.setItem(cacheKey, JSON.stringify(user));
  return user;
};

const styles = createStaticStyles(({ css, cssVar }) => ({
  controls: css`
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    align-items: center;
    justify-content: space-between;

    padding-block: 12px;
    padding-inline: 16px;
    border-block-end: 1px solid rgb(0 0 0 / 6%);
  `,
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
    position: absolute;
    z-index: 1;
    inset-block-end: 0;
    inset-inline: 0;

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
  annotationBubble: css`
    display: grid;
    gap: 8px;

    min-width: 240px;
    max-width: min(360px, calc(100vw - 32px));
    padding: 12px;
    border: 1px solid ${cssVar.colorBorderSecondary};
    border-radius: 10px;

    background: ${cssVar.colorBgElevated};
    box-shadow: ${cssVar.boxShadowSecondary};
  `,
  annotationComposer: css`
    display: grid;
    gap: 10px;

    width: min(360px, calc(100vw - 32px));
    padding: 12px;
    border: 1px solid ${cssVar.colorBorderSecondary};
    border-radius: 10px;

    background: ${cssVar.colorBgElevated};
    box-shadow: ${cssVar.boxShadowSecondary};
  `,
  annotationAction: css`
    display: inline-flex;
    gap: 6px;
    align-items: center;

    height: 36px;
    padding-inline: 10px;
    border: 0;
    border-radius: 8px;

    font-size: 13px;
    color: ${cssVar.colorTextSecondary};

    background: transparent;
    cursor: pointer;

    &:hover {
      color: ${cssVar.colorText};
      background: ${cssVar.colorFillSecondary};
    }
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
  modeBar: css`
    display: flex;
    justify-content: flex-end;
    padding-block: 12px;
    padding-inline: 0;
  `,
}));

const WEBSOCKET_DOCUMENT_ID = 'editor-demo';
const connectionStatusColors: Record<WebSocketYjsProviderStatus, string> = {
  connected: 'success',
  connecting: 'processing',
  disconnected: 'error',
  reconnecting: 'warning',
};

function getInitialYjsDemoMode(): 'broadcast' | 'websocket' {
  if (typeof window === 'undefined') return 'broadcast';

  return new URLSearchParams(window.location.search).get('yjsMode') === 'websocket'
    ? 'websocket'
    : 'broadcast';
}

type EditorDemoProps = Pick<CollapseProps, 'collapsible' | 'defaultActiveKey'> & {
  content: unknown;
  onEditorReady?: (editor: IEditor) => void;
  providerFactory: YjsProviderFactory;
  renderControls?: (editor: IEditor) => ReactNode;
};

function getDocumentSafely<T>(editor: IEditor, type: string, fallback: T): T {
  try {
    return (editor.getDocument(type) as T) || fallback;
  } catch {
    return fallback;
  }
}

const AnnotationComposer: FC<AnnotationComposerContext> = ({ close, quotedText, submit }) => {
  const [text, setText] = useState('');

  return (
    <div className={styles.annotationComposer}>
      <Text type={'secondary'}>评论选中文本：{quotedText || '（无选中文本）'}</Text>
      <Input.TextArea
        autoFocus
        placeholder={'写下你的评论'}
        rows={3}
        value={text}
        onChange={(event) => setText(event.target.value)}
      />
      <Space direction={'horizontal'} size={8}>
        <Button size={'small'} onClick={close}>
          取消
        </Button>
        <Button
          disabled={!text.trim()}
          size={'small'}
          type={'primary'}
          onClick={() => submit({ kind: 'comment', payload: { text: text.trim() } })}
        >
          提交
        </Button>
      </Space>
    </div>
  );
};

const renderAnnotationBubble = ({ close, records }: AnnotationBubbleContext) => (
  <div className={styles.annotationBubble}>
    {records.map((record) => (
      <div key={record.id}>
        <Text strong>{record.kind === 'comment' ? '评论' : record.kind}</Text>
        <div>{getAnnotationText(record.payload)}</div>
      </div>
    ))}
    <Button size={'small'} type={'text'} onClick={close}>
      关闭
    </Button>
  </div>
);

const getAnnotationText = (payload: AnnotationBubbleContext['records'][number]['payload']) => {
  if (typeof payload === 'string') return payload;
  if (payload && typeof payload === 'object' && !Array.isArray(payload) && 'text' in payload) {
    const text = payload.text;
    if (typeof text === 'string') return text;
  }
  return JSON.stringify(payload);
};

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

const EditorDemo: FC<EditorDemoProps> = ({
  content,
  onEditorReady,
  providerFactory,
  renderControls,
  ...props
}) => {
  const editor = useEditor();
  const [json, setJson] = useState('');
  const [markdown, setMarkdown] = useState('');
  const [xml, setXml] = useState('');
  const tabUser = useMemo(() => getTabUser(), []);
  const editorContent = useMemo(() => {
    const document = content as { root?: { children?: unknown[] } };
    if (!document?.root?.children) return content;

    return {
      ...document,
      root: {
        ...document.root,
        children: [...linkDemoContent.root.children, ...document.root.children],
      },
    };
  }, [content]);

  const handleChange = useMemo(
    () =>
      debounce((editor: IEditor) => {
        const markdownContent = getDocumentSafely(editor, 'markdown', '');
        const jsonContent = getDocumentSafely<Record<string, any>>(editor, 'json', {});
        const xmlContent = getDocumentSafely(editor, 'litexml', '');
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
    onEditorReady?.(editor);
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
        icon: PanelsTopLeftIcon,
        key: 'artifact',
        label: 'Artifact',
        onSelect: (editor) => {
          editor.dispatchCommand(INSERT_ARTIFACT_COMMAND, {
            html: `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <style>
      body { font-family: system-ui; padding: 32px; }
      .card { padding: 24px; border: 1px solid #ddd; border-radius: 16px; }
    </style>
  </head>
  <body>
    <div class="card"><h1>Hello Artifact</h1><p>Edit the HTML on the left.</p></div>
  </body>
</html>`,
            title: 'HTML Artifact',
          });
        },
      },
      {
        type: 'divider',
      },
      {
        icon: ListCollapseIcon,
        key: 'collapsible',
        label: '折叠块',
        onSelect: (editor) => {
          editor.dispatchCommand(INSERT_COLLAPSIBLE_COMMAND, {});
          queueMicrotask(() => {
            editor.focus();
          });
        },
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
      <div className={styles.controls}>
        <Toolbar editor={editor} />
        {renderControls?.(editor)}
      </div>
      <Editor
        className={styles.editor}
        content={editorContent}
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
          ReactArtifactPlugin,
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
                  style={{
                    border: 0,
                    display: 'block',
                    visibility: isLoading ? 'hidden' : 'visible',
                    width: '100%',
                  }}
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
          ReactCollapsiblePlugin,
          ReactHRPlugin,
          ReactTablePlugin,
          ReactMathPlugin,
          ReactCodePlugin,
          ReactTocPlugin,
          Editor.withProps(ReactYjsPlugin, {
            cursorColor: tabUser.color,
            id: 'editor-demo',
            providerFactory,
            username: tabUser.name,
          }),
          Editor.withProps(ReactNodePropertiesPlugin, {
            renderAnnotationBubble,
            renderComposer: (context) => <AnnotationComposer {...context} />,
          }),
          Editor.withProps(ReactToolbarPlugin, {
            children: (
              <Toolbar
                annotationAction={
                  <AnnotationToolbarAction className={styles.annotationAction} kind={'comment'}>
                    <MessageSquareQuote size={16} />
                    <span>评论</span>
                  </AnnotationToolbarAction>
                }
                editor={editor}
                floating
              />
            ),
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
          maxLength: 16,
          searchKeys: ['key', 'label'],
        }}
      />
    </Container>
  );
};

const WebSocketJsonDemo: FC<Pick<CollapseProps, 'collapsible' | 'defaultActiveKey'>> = (props) => {
  const [content, setContent] = useState<unknown>(null);
  const [connectionStatus, setConnectionStatus] =
    useState<WebSocketYjsProviderStatus>('disconnected');
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState('Not saved');
  const editorReference = useRef<IEditor | null>(null);
  const providersReference = useRef(new Set<ReturnType<typeof createWebSocketYjsProvider>>());

  const providerFactory = useCallback<YjsProviderFactory>((id, yjsDocMap) => {
    const provider = createWebSocketYjsProvider(id, yjsDocMap);
    providersReference.current.add(provider);

    provider.on('status', ({ status }) => {
      setConnectionStatus(status);
    });

    return provider;
  }, []);

  const snapshotCurrentDocument = useCallback(() => {
    if (!editorReference.current) {
      return;
    }

    snapshotWebSocketDemoDocument(
      WEBSOCKET_DOCUMENT_ID,
      getDocumentSafely(editorReference.current, 'json', {}),
    );
  }, []);

  useEffect(() => {
    let isMounted = true;

    fetchWebSocketDemoDocument(WEBSOCKET_DOCUMENT_ID)
      .then((data) => {
        if (!isMounted) return;
        setContent(data);
        setLoadError(null);
      })
      .catch((error) => {
        if (!isMounted) return;
        setLoadError(error instanceof Error ? error.message : 'Failed to load document');
      });

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    window.addEventListener('beforeunload', snapshotCurrentDocument);

    return () => {
      snapshotCurrentDocument();
      providersReference.current.forEach((provider) => provider.disconnect());
      providersReference.current.clear();
      window.removeEventListener('beforeunload', snapshotCurrentDocument);
    };
  }, [snapshotCurrentDocument]);

  if (loadError) {
    return (
      <Alert message={`WebSocket demo server is not ready: ${loadError}`} showIcon type="warning" />
    );
  }

  if (!content) {
    return <Alert message="Loading document JSON from demo server..." showIcon type="info" />;
  }

  return (
    <EditorDemo
      content={content}
      onEditorReady={(editor) => {
        editorReference.current = editor;
      }}
      providerFactory={providerFactory}
      renderControls={(editor) => (
        <Space size={8}>
          <Tag color={connectionStatusColors[connectionStatus]}>{connectionStatus}</Tag>
          <Text code fontSize={12} type="secondary">
            {saveStatus}
          </Text>
          <Button
            onClick={async () => {
              setSaveStatus('Saving...');
              try {
                await saveWebSocketDemoDocument(
                  WEBSOCKET_DOCUMENT_ID,
                  getDocumentSafely(editor, 'json', {}),
                );
                setSaveStatus(`Saved ${new Date().toLocaleTimeString()}`);
              } catch (error) {
                setSaveStatus(error instanceof Error ? error.message : 'Save failed');
              }
            }}
            size="small"
          >
            Save JSON
          </Button>
        </Space>
      )}
      {...props}
    />
  );
};

const Demo: FC<Pick<CollapseProps, 'collapsible' | 'defaultActiveKey'>> = (props) => {
  const [mode, setMode] = useState<'broadcast' | 'websocket'>(getInitialYjsDemoMode);

  return (
    <>
      <div className={styles.modeBar}>
        <Segmented
          onChange={(value) => {
            const nextMode = value as 'broadcast' | 'websocket';
            setMode(nextMode);

            if (typeof window !== 'undefined') {
              const url = new URL(window.location.href);

              if (nextMode === 'websocket') {
                url.searchParams.set('yjsMode', 'websocket');
              } else {
                url.searchParams.delete('yjsMode');
              }

              window.history.replaceState(null, '', url);
            }
          }}
          options={[
            { label: 'BroadcastChannel', value: 'broadcast' },
            { label: 'WebSocket JSON', value: 'websocket' },
          ]}
          size="small"
          value={mode}
        />
      </div>
      {mode === 'websocket' ? (
        <WebSocketJsonDemo key="websocket" {...props} />
      ) : (
        <EditorDemo
          content={localContent}
          key="broadcast"
          providerFactory={createBroadcastChannelYjsProvider}
          {...props}
        />
      )}
    </>
  );
};

export default Demo;
