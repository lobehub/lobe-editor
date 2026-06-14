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
  ReactYjsPlugin,
  type SlashOptions,
  type YjsProviderFactory,
  scrollIntoView,
} from '@lobehub/editor';
import { Editor, useEditor } from '@lobehub/editor/react';
import { Avatar, type CollapseProps, Text } from '@lobehub/ui';
import { Alert, Button, Segmented, Space, Tag } from 'antd';
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
import { type FC, type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { devConsole } from '@/utils/debug';

import { createBroadcastChannelYjsProvider } from './BroadcastChannelYjsProvider';
import Container from './Container';
import Toolbar from './Toolbar';
import {
  type WebSocketYjsProviderStatus,
  createWebSocketYjsProvider,
  fetchWebSocketDemoDocument,
  saveWebSocketDemoDocument,
  snapshotWebSocketDemoDocument,
} from './WebSocketYjsProvider';
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

const styles = createStaticStyles(({ css }) => ({
  controls: css`
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    align-items: center;
    justify-content: space-between;

    padding-block: 12px;
    padding-inline: 16px;
    border-block-end: 1px solid rgba(0, 0, 0, 6%);
  `,
  editor: css`
    padding: 16px;
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
  if (typeof window === 'undefined') {
    return 'broadcast';
  }

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
      <div className={styles.controls}>
        <Toolbar editor={editor} />
        {renderControls?.(editor)}
      </div>
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
          Editor.withProps(ReactYjsPlugin, {
            cursorColor: tabUser.color,
            id: 'editor-demo',
            providerFactory,
            username: tabUser.name,
          }),
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
