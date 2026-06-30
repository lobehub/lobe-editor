import type { Provider } from '@lexical/yjs';
import { ReactCodeblockPlugin } from '@lobehub/editor/plugins/codeblock';
import { ReactImagePlugin } from '@lobehub/editor/plugins/image';
import { ReactListPlugin } from '@lobehub/editor/plugins/list';
import { ReactTablePlugin } from '@lobehub/editor/plugins/table';
import type { EditorProps } from '@lobehub/editor/react';
import { Editor, EditorProvider, useEditor } from '@lobehub/editor/react';
import type { CSSProperties } from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Doc } from 'yjs';

import { BusinessCollaborationProvider } from './BusinessCollaborationProvider';
import { fetchPage, fetchRoomSnapshot, resetRoom, submitAiTask } from './api';
import { emptyPageContent, getInitialPageContent } from './editorContent';
import type { AiSelectionRequest, BusinessUser, PageMetadata } from './types';

const workspaceId = 'workspace-alpha';
const pageIds = ['launch-notes', 'roadmap', 'retrospective'] as const;

type CollaborationConfig = Exclude<EditorProps['collaboration'], false | undefined>;
type EditorPlugin = NonNullable<EditorProps['plugins']>[number];

const users: BusinessUser[] = [
  {
    color: '#2563eb',
    id: 'u_alice',
    name: 'Alice',
  },
  {
    color: '#16a34a',
    id: 'u_bo',
    name: 'Bo',
  },
  {
    color: '#9333ea',
    id: 'u_cara',
    name: 'Cara',
  },
];

interface AiTaskPanelProps {
  onTaskComplete: () => void;
  roomId: string;
}

const AiTaskPanel = ({ onTaskComplete, roomId }: AiTaskPanelProps) => {
  const [history, setHistory] = useState<
    Array<{ prompt: string; response: string; taskId: string }>
  >([]);
  const [error, setError] = useState<string>();
  const [prompt, setPrompt] = useState('Draft a concise launch-risk note for the team');
  const [submitting, setSubmitting] = useState(false);

  const runTask = useCallback(async () => {
    const trimmedPrompt = prompt.trim();
    if (!trimmedPrompt || submitting) return;

    setSubmitting(true);
    setError(undefined);

    try {
      const response = await submitAiTask(roomId, trimmedPrompt);
      setHistory((items) => [
        {
          prompt: trimmedPrompt,
          response: response.insertedText,
          taskId: response.taskId,
        },
        ...items,
      ]);
      onTaskComplete();
    } catch (error_) {
      setError(error_ instanceof Error ? error_.message : 'Failed to run AI task');
    } finally {
      setSubmitting(false);
    }
  }, [onTaskComplete, prompt, roomId, submitting]);

  return (
    <aside className="ai-panel">
      <div>
        <div className="eyebrow">Node AI Actor</div>
        <h2>AI task runner</h2>
      </div>
      <textarea
        onChange={(event) => {
          setPrompt(event.target.value);
        }}
        value={prompt}
      />
      <button
        className="control-button ai-submit"
        disabled={submitting}
        onClick={runTask}
        type="button"
      >
        {submitting ? 'Running...' : 'Run task'}
      </button>
      {error ? <div className="ai-error">{error}</div> : null}
      <div className="ai-feed">
        {history.map((item) => (
          <article className="ai-message" key={item.taskId}>
            <strong>{item.prompt}</strong>
            <p>{item.response}</p>
          </article>
        ))}
      </div>
    </aside>
  );
};

interface ClientPaneProps {
  editable?: boolean;
  onSelectionTaskComplete: () => void;
  page: PageMetadata;
  role: string;
  roomId: string;
  shouldBootstrap?: boolean;
  user: BusinessUser;
}

const collaborationPlugins: EditorPlugin[] = [
  ReactListPlugin,
  ReactTablePlugin,
  ReactImagePlugin,
  ReactCodeblockPlugin,
];

const ClientPane = ({
  editable = true,
  onSelectionTaskComplete,
  page,
  role,
  roomId,
  shouldBootstrap = false,
  user,
}: ClientPaneProps) => {
  const editor = useEditor();
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const paneRef = useRef<HTMLElement>(null);
  const [connected, setConnected] = useState(true);
  const [focusState, setFocusState] = useState('blurred');
  const [inlineError, setInlineError] = useState<string>();
  const [inlineSelection, setInlineSelection] = useState<
    | {
        occurrenceIndex: number;
        promptPosition: {
          left: number;
          top: number;
        };
        selectedText: string;
        toolbarPosition: {
          left: number;
          top: number;
        };
      }
    | undefined
  >();
  const [inlinePromptOpen, setInlinePromptOpen] = useState(false);
  const [inlineSubmitting, setInlineSubmitting] = useState(false);
  const [status, setStatus] = useState('idle');
  const [syncState, setSyncState] = useState('not synced');
  const yjsDocMap = useMemo(() => new Map([[roomId, new Doc()]]), [roomId]);
  const initialContent = shouldBootstrap ? getInitialPageContent(page.id) : emptyPageContent;

  const providerFactory = useMemo(
    () =>
      ((id: string, docMap: Map<string, Doc>): Provider => {
        const doc = docMap.get(id);

        if (!doc) {
          throw new Error(`Missing Y.Doc for room ${id}`);
        }

        return new BusinessCollaborationProvider(id, doc);
      }) satisfies CollaborationConfig['providerFactory'],
    [],
  );

  const collaboration = useMemo<CollaborationConfig>(
    () => ({
      connect: connected,
      id: roomId,
      onStatusChange: setStatus,
      onSync: (isSynced) => {
        setSyncState(isSynced ? 'synced' : 'syncing');
      },
      providerFactory,
      shouldBootstrap,
      user: {
        awarenessData: {
          editable,
          pageId: page.id,
          role,
          userId: user.id,
          workspaceId: page.workspaceId,
        },
        color: user.color,
        focusing: connected,
        name: user.name,
      },
      yjsDocMap,
    }),
    [
      connected,
      editable,
      page.id,
      page.workspaceId,
      providerFactory,
      role,
      roomId,
      shouldBootstrap,
      user,
      yjsDocMap,
    ],
  );

  const captureSelection = useCallback(() => {
    if (!editable || !paneRef.current) return;

    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0 || selection.isCollapsed) {
      if (document.activeElement === iframeRef.current || inlineSelection) return;

      setInlineSelection(undefined);
      return;
    }

    const range = selection.getRangeAt(0);
    if (!paneRef.current.contains(range.commonAncestorContainer)) return;

    const editorElement = paneRef.current.querySelector('.business-editor');
    if (!editorElement?.contains(range.commonAncestorContainer)) return;

    const selectedText = selection.toString().trim();
    if (!selectedText) {
      setInlineSelection(undefined);
      return;
    }

    const beforeRange = range.cloneRange();
    beforeRange.selectNodeContents(editorElement);
    beforeRange.setEnd(range.startContainer, range.startOffset);

    const beforeText = beforeRange.toString();
    const occurrenceIndex = beforeText.split(selectedText).length - 1;
    const rect = range.getBoundingClientRect();

    setInlineError(undefined);
    setInlinePromptOpen(false);
    setInlineSelection({
      occurrenceIndex,
      promptPosition: {
        left: Math.min(window.innerWidth - 340, Math.max(16, rect.left)),
        top: Math.min(window.innerHeight - 178, Math.max(16, rect.bottom + 8)),
      },
      selectedText,
      toolbarPosition: {
        left: Math.min(window.innerWidth - 172, Math.max(16, rect.left + rect.width / 2 - 86)),
        top: Math.max(16, rect.top - 46),
      },
    });
  }, [editable, inlineSelection]);

  useEffect(() => {
    if (!editable) return;

    document.addEventListener('selectionchange', captureSelection);

    return () => {
      document.removeEventListener('selectionchange', captureSelection);
    };
  }, [captureSelection, editable]);

  const submitInlineTask = useCallback(async () => {
    if (!inlineSelection || inlineSubmitting) return;

    const currentSelection = inlineSelection;
    const prompt = iframeRef.current?.contentDocument?.body.textContent?.trim() || '';

    if (!prompt) {
      setInlineError('Enter an edit request first.');
      return;
    }

    const selection: AiSelectionRequest = {
      occurrenceIndex: currentSelection.occurrenceIndex,
      selectedText: currentSelection.selectedText,
    };

    setInlineSubmitting(true);
    setInlineError(undefined);
    setInlinePromptOpen(false);
    setInlineSelection(undefined);
    window.getSelection()?.removeAllRanges();

    try {
      await submitAiTask(roomId, prompt, selection);
      onSelectionTaskComplete();
    } catch (error_) {
      setInlineSelection(currentSelection);
      setInlinePromptOpen(true);
      setInlineError(error_ instanceof Error ? error_.message : 'Failed to run selected edit');
    } finally {
      setInlineSubmitting(false);
    }
  }, [inlineSelection, inlineSubmitting, onSelectionTaskComplete, roomId]);

  return (
    <section
      className="client-pane"
      onKeyUp={captureSelection}
      onMouseUp={captureSelection}
      ref={paneRef}
    >
      <div className="client-pane-header">
        <div>
          <div className="client-name" style={{ '--user-color': user.color } as CSSProperties}>
            {user.name}
          </div>
          <div className="client-meta">
            {role} · {editable ? 'editable' : 'read-only'} · {focusState}
          </div>
        </div>
        <div className="client-actions">
          <div className="client-status">
            <span>{connected ? status : 'detached'}</span>
            <span>{syncState}</span>
          </div>
          <button
            className="small-button"
            onClick={() => {
              setConnected((value) => !value);
              setStatus(connected ? 'detached' : 'idle');
            }}
            type="button"
          >
            {connected ? 'Disconnect' : 'Reconnect'}
          </button>
        </div>
      </div>
      <Editor
        className="business-editor"
        collaboration={collaboration}
        content={initialContent}
        editable={editable}
        editor={editor}
        onBlur={() => {
          setFocusState('blurred');
        }}
        onFocus={() => {
          setFocusState('focused');
        }}
        placeholder="Write page content..."
        plugins={collaborationPlugins}
        type="json"
      />
      {inlineSelection && !inlinePromptOpen ? (
        <div
          className="selection-toolbar"
          data-testid="selection-ai-toolbar"
          onMouseDown={(event) => {
            event.preventDefault();
          }}
          style={{
            left: inlineSelection.toolbarPosition.left,
            top: inlineSelection.toolbarPosition.top,
          }}
        >
          <button
            className="selection-toolbar-button"
            data-testid="selection-ai-toolbar-button"
            onClick={() => {
              setInlineError(undefined);
              setInlinePromptOpen(true);
            }}
            type="button"
          >
            AI
          </button>
        </div>
      ) : null}
      {inlineSelection && inlinePromptOpen ? (
        <div
          className="selection-ai-popover"
          data-testid="selection-ai-popover"
          onKeyUp={(event) => {
            event.stopPropagation();
          }}
          onMouseUp={(event) => {
            event.stopPropagation();
          }}
          style={{
            left: inlineSelection.promptPosition.left,
            top: inlineSelection.promptPosition.top,
          }}
        >
          <iframe
            data-testid="selection-ai-iframe"
            onLoad={() => {
              iframeRef.current?.contentDocument
                ?.querySelector<HTMLElement>('[contenteditable]')
                ?.focus();
            }}
            ref={iframeRef}
            srcDoc={[
              '<!doctype html><html><head><style>',
              'body{margin:0;font:13px/1.45 system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;color:#171717;}',
              '[contenteditable]{min-height:54px;outline:none;white-space:pre-wrap;}',
              '[contenteditable]:empty:before{content:"Describe the change...";color:#94a3b8;}',
              '</style></head><body><div contenteditable="true"></div></body></html>',
            ].join('')}
            title="Selected text AI edit request"
          />
          <div className="selection-ai-actions">
            <button
              className="small-button"
              onClick={() => {
                setInlinePromptOpen(false);
                setInlineSelection(undefined);
              }}
              type="button"
            >
              Cancel
            </button>
            <button
              className="control-button ai-submit"
              data-testid="selection-ai-submit"
              disabled={inlineSubmitting}
              onClick={submitInlineTask}
              type="button"
            >
              {inlineSubmitting ? 'Editing...' : 'Ask AI'}
            </button>
          </div>
          {inlineError ? <div className="ai-error compact">{inlineError}</div> : null}
        </div>
      ) : null}
    </section>
  );
};

export const App = () => {
  const [activePageId, setActivePageId] = useState<(typeof pageIds)[number]>('launch-notes');
  const [showBo, setShowBo] = useState(true);
  const [page, setPage] = useState<PageMetadata>();
  const [roomId, setRoomId] = useState('');
  const [roomHasContent, setRoomHasContent] = useState(false);
  const [error, setError] = useState<string>();
  const [sessionKey, setSessionKey] = useState(0);

  useEffect(() => {
    setPage(undefined);
    setRoomId('');
    setRoomHasContent(false);
    setError(undefined);

    fetchPage(workspaceId, activePageId)
      .then(async (response) => {
        const snapshot = await fetchRoomSnapshot(response.roomId);
        setPage(response.page);
        setRoomId(response.roomId);
        setRoomHasContent(snapshot.hasContent);
      })
      .catch((error_: unknown) => {
        setError(error_ instanceof Error ? error_.message : 'Failed to load page metadata');
      });
  }, [activePageId]);

  useEffect(() => {
    if (!page || !roomId || roomHasContent) return;

    let cancelled = false;
    const intervalId = setInterval(() => {
      fetchRoomSnapshot(roomId)
        .then((snapshot) => {
          if (cancelled || !snapshot.hasContent) return;

          setRoomHasContent(true);
          setSessionKey((value) => value + 1);
          clearInterval(intervalId);
        })
        .catch(() => {});
    }, 500);

    return () => {
      cancelled = true;
      clearInterval(intervalId);
    };
  }, [page, roomHasContent, roomId]);

  const remountClients = useCallback(() => {
    setSessionKey((value) => value + 1);
  }, []);

  const resetActiveRoom = useCallback(() => {
    if (!roomId) return;

    resetRoom(roomId)
      .then(() => {
        setRoomHasContent(false);
        remountClients();
      })
      .catch((error_: unknown) => {
        setError(error_ instanceof Error ? error_.message : 'Failed to reset room');
      });
  }, [remountClients, roomId]);

  if (error) {
    return <main className="app-shell error-state">{error}</main>;
  }

  if (!page || !roomId) {
    return <main className="app-shell loading-state">Loading collaboration room...</main>;
  }

  return (
    <EditorProvider>
      <main className="app-shell">
        <header className="topbar">
          <div>
            <div className="eyebrow">Workspace Page Collaboration MVP</div>
            <h1>{page.title}</h1>
          </div>
          <div className="room-chip">{roomId}</div>
        </header>

        <section className="control-bar">
          <div className="segmented">
            {pageIds.map((pageId) => (
              <button
                className={pageId === activePageId ? 'active' : ''}
                key={pageId}
                onClick={() => {
                  setActivePageId(pageId);
                  setSessionKey((value) => value + 1);
                }}
                type="button"
              >
                {pageId}
              </button>
            ))}
          </div>
          <button className="control-button" onClick={remountClients} type="button">
            Re-enter clients
          </button>
          <button
            className="control-button"
            onClick={() => {
              setShowBo((value) => !value);
            }}
            type="button"
          >
            {showBo ? 'Remove Bo' : 'Rejoin Bo'}
          </button>
          <button className="control-button danger" onClick={resetActiveRoom} type="button">
            Reset room
          </button>
        </section>

        <section className="integration-summary">
          <div>
            <span>First open</span>
            <strong>JSON bootstrap only once</strong>
          </div>
          <div>
            <span>Re-enter</span>
            <strong>room snapshot hydrate</strong>
          </div>
          <div>
            <span>AI presence</span>
            <strong>assistant cursor via awareness</strong>
          </div>
          <div>
            <span>Server edit</span>
            <strong>Yjs update broadcast</strong>
          </div>
        </section>

        <section className="workspace-grid">
          <section className="pane-grid" key={`${roomId}:${sessionKey}`}>
            <ClientPane
              onSelectionTaskComplete={() => {
                setRoomHasContent(true);
              }}
              page={page}
              role="Bootstrap client"
              roomId={roomId}
              shouldBootstrap={!roomHasContent}
              user={users[0]}
            />
            {showBo ? (
              <ClientPane
                onSelectionTaskComplete={() => {
                  setRoomHasContent(true);
                }}
                page={page}
                role="Joining client"
                roomId={roomId}
                user={users[1]}
              />
            ) : null}
          </section>
          <AiTaskPanel
            onTaskComplete={() => {
              setRoomHasContent(true);
            }}
            roomId={roomId}
          />
        </section>
      </main>
    </EditorProvider>
  );
};
