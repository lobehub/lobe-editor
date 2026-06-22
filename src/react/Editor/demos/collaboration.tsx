import type { Provider, ProviderAwareness, UserState } from '@lexical/yjs';
import type { EditorCollaborationConfig, IEditor } from '@lobehub/editor';
import { ReactBlockPlugin } from '@lobehub/editor';
import { Editor, useEditor } from '@lobehub/editor/react';
import type { CollapseProps } from '@lobehub/ui';
import { Block, Flexbox, Text } from '@lobehub/ui';
import { debounce } from 'es-toolkit';
import { type FC, useCallback, useMemo, useState } from 'react';
import { Doc, applyUpdate, encodeStateAsUpdate } from 'yjs';

import Container from './Container';
import content from './disableMakrdownData.json';

class InMemoryCollaborationRoom {
  private awarenessStates = new Map<number, UserState>();
  private providers = new Set<InMemoryProvider>();

  addProvider(provider: InMemoryProvider) {
    const source: InMemoryProvider | undefined = this.providers.values().next().value;
    this.providers.add(provider);

    if (source && source !== provider) {
      provider.syncFrom(source.doc);
    }

    this.emitAwarenessUpdate();
  }

  broadcastDocUpdate(source: InMemoryProvider, update: Uint8Array) {
    for (const provider of this.providers) {
      if (provider !== source) {
        provider.receiveUpdate(update);
      }
    }
  }

  getAwarenessStates() {
    return new Map(this.awarenessStates);
  }

  removeProvider(provider: InMemoryProvider) {
    this.providers.delete(provider);
    this.awarenessStates.delete(provider.clientID);
    this.emitAwarenessUpdate();
  }

  setAwarenessState(clientID: number, state: UserState | null) {
    if (state) {
      this.awarenessStates.set(clientID, state);
    } else {
      this.awarenessStates.delete(clientID);
    }

    this.emitAwarenessUpdate();
  }

  private emitAwarenessUpdate() {
    for (const provider of this.providers) {
      provider.awareness.emitUpdate();
    }
  }
}

class InMemoryAwareness implements ProviderAwareness {
  private localState: UserState | null = null;
  private updateListeners = new Set<() => void>();

  constructor(
    private readonly room: InMemoryCollaborationRoom,
    private readonly clientID: number,
  ) {}

  emitUpdate() {
    for (const listener of this.updateListeners) {
      listener();
    }
  }

  getLocalState = () => this.localState;

  getStates = () => this.room.getAwarenessStates();

  off = (_type: 'update', callback: () => void) => {
    this.updateListeners.delete(callback);
  };

  on = (_type: 'update', callback: () => void) => {
    this.updateListeners.add(callback);
  };

  setLocalState = (state: UserState | null) => {
    this.localState = state;
    this.room.setAwarenessState(this.clientID, state);
  };

  setLocalStateField = (field: string, value: unknown) => {
    this.setLocalState({
      ...(this.localState ?? {
        anchorPos: null,
        awarenessData: {},
        color: '#1677ff',
        focusPos: null,
        focusing: true,
        name: 'Local',
      }),
      [field]: value,
    });
  };
}

class InMemoryProvider implements Provider {
  readonly awareness: InMemoryAwareness;
  readonly clientID: number;
  private connected = false;
  private readonly reloadListeners = new Set<(_doc: Doc) => void>();
  private readonly statusListeners = new Set<(_event: { status: string }) => void>();
  private readonly syncListeners = new Set<(_isSynced: boolean) => void>();
  private readonly updateListeners = new Set<(_event: unknown) => void>();

  constructor(
    private readonly room: InMemoryCollaborationRoom,
    readonly doc: Doc,
  ) {
    this.clientID = doc.clientID;
    this.awareness = new InMemoryAwareness(room, this.clientID);
  }

  connect() {
    if (this.connected) return;

    this.connected = true;
    this.doc.on('update', this.handleDocUpdate);
    this.room.addProvider(this);
    this.emitStatus('connected');
    this.emitSync(true);
  }

  disconnect() {
    if (!this.connected) return;

    this.connected = false;
    this.room.removeProvider(this);
    this.doc.off('update', this.handleDocUpdate);
    this.emitStatus('disconnected');
  }

  off(type: ProviderEventType, callback: ProviderListener) {
    if (type === 'sync') {
      this.syncListeners.delete(callback as (isSynced: boolean) => void);
      return;
    }

    if (type === 'status') {
      this.statusListeners.delete(callback as (event: { status: string }) => void);
      return;
    }

    if (type === 'reload') {
      this.reloadListeners.delete(callback as (doc: Doc) => void);
      return;
    }

    this.updateListeners.delete(callback as (event: unknown) => void);
  }

  on(type: ProviderEventType, callback: ProviderListener) {
    if (type === 'sync') {
      this.syncListeners.add(callback as (isSynced: boolean) => void);
      return;
    }

    if (type === 'status') {
      this.statusListeners.add(callback as (event: { status: string }) => void);
      return;
    }

    if (type === 'reload') {
      this.reloadListeners.add(callback as (doc: Doc) => void);
      return;
    }

    this.updateListeners.add(callback as (event: unknown) => void);
  }

  receiveUpdate(update: Uint8Array) {
    applyUpdate(this.doc, update, this.room);
  }

  syncFrom(sourceDoc: Doc) {
    applyUpdate(this.doc, encodeStateAsUpdate(sourceDoc), this.room);
  }

  private emitStatus(status: string) {
    for (const listener of this.statusListeners) {
      listener({ status });
    }
  }

  private emitSync(isSynced: boolean) {
    for (const listener of this.syncListeners) {
      listener(isSynced);
    }
  }

  private readonly handleDocUpdate = (update: Uint8Array, origin: unknown) => {
    if (!this.connected || origin === this.room) return;

    for (const listener of this.updateListeners) {
      listener(update);
    }

    this.room.broadcastDocUpdate(this, update);
  };
}

const roomId = 'lobe-editor-collaboration-demo';
type ProviderEventType = 'reload' | 'status' | 'sync' | 'update';
type ProviderListener =
  | ((_doc: Doc) => void)
  | ((_event: unknown) => void)
  | ((_event: { status: string }) => void)
  | ((_isSynced: boolean) => void);

const Demo: FC<Pick<CollapseProps, 'collapsible' | 'defaultActiveKey'>> = (props) => {
  const leftEditor = useEditor();
  const rightEditor = useEditor();
  const leftYjsDocMap = useMemo(() => new Map([[roomId, new Doc()]]), []);
  const rightYjsDocMap = useMemo(() => new Map([[roomId, new Doc()]]), []);
  const room = useMemo(() => new InMemoryCollaborationRoom(), []);
  const [json, setJson] = useState('');
  const [markdown, setMarkdown] = useState('');

  const providerFactory = useCallback(
    (id: string, yjsDocMap: Map<string, Doc>) => {
      const doc = yjsDocMap.get(id);

      if (!doc) {
        throw new Error(`Missing Y.Doc for collaboration room: ${id}`);
      }

      return new InMemoryProvider(room, doc);
    },
    [room],
  );

  const createCollaborationConfig = useCallback(
    (
      name: string,
      color: string,
      yjsDocMap: Map<string, Doc>,
      shouldBootstrap = false,
    ): EditorCollaborationConfig => ({
      id: roomId,
      providerFactory,
      shouldBootstrap,
      user: {
        color,
        name,
      },
      yjsDocMap,
    }),
    [providerFactory],
  );

  const leftCollaboration = useMemo(
    () => createCollaborationConfig('Editor A', '#1677ff', leftYjsDocMap, true),
    [createCollaborationConfig, leftYjsDocMap],
  );

  const rightCollaboration = useMemo(
    () => createCollaborationConfig('Editor B', '#00a870', rightYjsDocMap),
    [createCollaborationConfig, rightYjsDocMap],
  );

  const handleChange = useMemo(
    () =>
      debounce((editor: IEditor) => {
        const markdownContent = editor.getDocument('markdown') as unknown as string;
        const jsonContent = editor.getDocument('json') as unknown as Record<string, unknown>;
        setMarkdown(markdownContent || '');
        setJson(JSON.stringify(jsonContent || {}, null, 2));
      }, 300),
    [],
  );

  return (
    <Container json={json} markdown={markdown} {...props}>
      <Flexbox gap={12} style={{ padding: 16 }}>
        <Text type={'secondary'}>
          Each editor owns an independent Y.Doc. The in-memory provider relays document updates and
          awareness states so remote selections render as collaborator cursors.
        </Text>
        <Flexbox gap={12} horizontal>
          <Block style={{ flex: 1, minWidth: 0 }} variant={'outlined'}>
            <Flexbox gap={8} style={{ padding: 12 }}>
              <Text strong>Editor A</Text>
              <Editor
                collaboration={leftCollaboration}
                content={content}
                editor={leftEditor}
                onInit={handleChange}
                onTextChange={handleChange}
                placeholder={'Type in editor A...'}
                plugins={[ReactBlockPlugin]}
              />
            </Flexbox>
          </Block>
          <Block style={{ flex: 1, minWidth: 0 }} variant={'outlined'}>
            <Flexbox gap={8} style={{ padding: 12 }}>
              <Text strong>Editor B</Text>
              <Editor
                collaboration={rightCollaboration}
                content={content}
                editor={rightEditor}
                onInit={handleChange}
                onTextChange={handleChange}
                placeholder={'Type in editor B...'}
                plugins={[ReactBlockPlugin]}
              />
            </Flexbox>
          </Block>
        </Flexbox>
      </Flexbox>
    </Container>
  );
};

export default Demo;
