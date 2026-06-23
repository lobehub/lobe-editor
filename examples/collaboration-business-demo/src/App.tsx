import type { Provider } from '@lexical/yjs';
import { ReactCodeblockPlugin } from '@lobehub/editor/plugins/codeblock';
import { ReactImagePlugin } from '@lobehub/editor/plugins/image';
import { ReactListPlugin } from '@lobehub/editor/plugins/list';
import { ReactTablePlugin } from '@lobehub/editor/plugins/table';
import type { EditorProps } from '@lobehub/editor/react';
import { Editor, EditorProvider, useEditor } from '@lobehub/editor/react';
import type { CSSProperties } from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Doc } from 'yjs';

import { BusinessCollaborationProvider } from './BusinessCollaborationProvider';
import { fetchPage, resetRoom } from './api';
import { emptyPageContent, getInitialPageContent } from './editorContent';
import type { BusinessUser, PageMetadata } from './types';

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

interface ClientPaneProps {
  editable?: boolean;
  onSynced?: () => void;
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
  onSynced,
  page,
  role,
  roomId,
  shouldBootstrap = false,
  user,
}: ClientPaneProps) => {
  const editor = useEditor();
  const [connected, setConnected] = useState(true);
  const [focusState, setFocusState] = useState('blurred');
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
        if (isSynced) {
          onSynced?.();
        }
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
      onSynced,
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

  return (
    <section className="client-pane">
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
    </section>
  );
};

export const App = () => {
  const [activePageId, setActivePageId] = useState<(typeof pageIds)[number]>('launch-notes');
  const [showBo, setShowBo] = useState(true);
  const [showObserver, setShowObserver] = useState(true);
  const [page, setPage] = useState<PageMetadata>();
  const [roomId, setRoomId] = useState('');
  const [seedReady, setSeedReady] = useState(false);
  const [error, setError] = useState<string>();
  const [sessionKey, setSessionKey] = useState(0);

  useEffect(() => {
    setPage(undefined);
    setRoomId('');
    setSeedReady(false);
    setError(undefined);

    fetchPage(workspaceId, activePageId)
      .then(async (response) => {
        await resetRoom(response.roomId);
        setPage(response.page);
        setRoomId(response.roomId);
      })
      .catch((error_: unknown) => {
        setError(error_ instanceof Error ? error_.message : 'Failed to load page metadata');
      });
  }, [activePageId]);

  const remountClients = useCallback(() => {
    setSessionKey((value) => value + 1);
  }, []);

  const markSeedReady = useCallback(() => {
    setSeedReady(true);
  }, []);

  const resetActiveRoom = useCallback(() => {
    if (!roomId) return;

    setSeedReady(false);
    resetRoom(roomId)
      .then(() => {
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
          <button
            className="control-button"
            onClick={() => {
              setShowObserver((value) => !value);
            }}
            type="button"
          >
            {showObserver ? 'Hide observer' : 'Show observer'}
          </button>
          <button className="control-button danger" onClick={resetActiveRoom} type="button">
            Reset room
          </button>
        </section>

        <section className="integration-summary">
          <div>
            <span>Room reset</span>
            <strong>fresh demo state</strong>
          </div>
          <div>
            <span>Alice</span>
            <strong>seeds initial JSON</strong>
          </div>
          <div>
            <span>Bo and Cara</span>
            <strong>join same room</strong>
          </div>
          <div>
            <span>Presence</span>
            <strong>remote cursor only</strong>
          </div>
        </section>

        <section className="pane-grid" key={`${roomId}:${sessionKey}`}>
          <ClientPane
            onSynced={markSeedReady}
            page={page}
            role="Seed client"
            roomId={roomId}
            shouldBootstrap
            user={users[0]}
          />
          {showBo && seedReady ? (
            <ClientPane page={page} role="Room peer" roomId={roomId} user={users[1]} />
          ) : null}
          {showObserver && seedReady ? (
            <ClientPane
              editable={false}
              page={page}
              role="Read-only peer"
              roomId={roomId}
              user={users[2]}
            />
          ) : null}
        </section>
      </main>
    </EditorProvider>
  );
};
