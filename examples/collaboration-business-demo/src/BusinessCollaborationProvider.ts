import type { Provider, UserState } from '@lexical/yjs';
import { Doc, XmlElement, applyUpdate, encodeStateAsUpdate } from 'yjs';

import {
  createRoomEventSource,
  fetchRoomSnapshot,
  postAwarenessUpdate,
  postDocumentUpdate,
} from './api';
import { BusinessAwareness, serializeUserState } from './awareness';
import { base64ToBytes, bytesToBase64 } from './codec';
import type {
  AwarenessEventPayload,
  DocumentSnapshotEventPayload,
  DocumentUpdateEventPayload,
  RoomResetEventPayload,
} from './types';

const serverUpdateOrigin = Symbol('server-update');

const docHasCollaborationContent = (doc: Doc) => doc.get('root-v2', XmlElement).length > 0;

type ProviderEventType = 'reload' | 'status' | 'sync' | 'update';
type ProviderListener =
  | ((_doc: Doc) => void)
  | ((_event: unknown) => void)
  | ((_event: { status: string }) => void)
  | ((_isSynced: boolean) => void);

export class BusinessCollaborationProvider implements Provider {
  readonly awareness: BusinessAwareness;
  private connected = false;
  private eventSource: EventSource | undefined;
  private readonly reloadListeners = new Set<(_doc: Doc) => void>();
  private readonly statusListeners = new Set<(_event: { status: string }) => void>();
  private readonly syncListeners = new Set<(_isSynced: boolean) => void>();
  private readonly updateListeners = new Set<(_event: unknown) => void>();

  constructor(
    private readonly roomId: string,
    private readonly doc: Doc,
  ) {
    this.awareness = new BusinessAwareness(doc.clientID, this.publishAwareness);
  }

  async connect() {
    if (this.connected) return;

    this.connected = true;
    this.doc.on('update', this.handleLocalDocumentUpdate);
    this.emitStatus('connecting');

    const snapshot = await fetchRoomSnapshot(this.roomId);

    if (!this.connected) return;

    this.openEventSource();

    if (snapshot.update) {
      applyUpdate(this.doc, base64ToBytes(snapshot.update), serverUpdateOrigin);
    } else if (docHasCollaborationContent(this.doc)) {
      await this.publishDocumentUpdate(encodeStateAsUpdate(this.doc));
    }

    this.awareness.applyRemoteStates(snapshot.awareness);
    this.publishAwareness(this.awareness.getLocalState());
    this.emitStatus('connected');
    this.emitSync(true);
  }

  disconnect() {
    if (!this.connected) return;

    this.connected = false;
    this.awareness.setLocalState(null);
    this.eventSource?.close();
    this.eventSource = undefined;
    this.doc.off('update', this.handleLocalDocumentUpdate);
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

  private readonly handleLocalDocumentUpdate = (update: Uint8Array, origin: unknown) => {
    if (!this.connected || origin === serverUpdateOrigin) return;

    for (const listener of this.updateListeners) {
      listener(update);
    }

    void this.publishDocumentUpdate(update).catch((error: unknown) => {
      console.error(error);
      this.emitStatus('error');
    });
  };

  private openEventSource() {
    const eventSource = createRoomEventSource(this.roomId, this.doc.clientID);
    this.eventSource = eventSource;

    eventSource.addEventListener('document-snapshot', (event) => {
      const payload = JSON.parse(event.data) as DocumentSnapshotEventPayload;
      if (!payload.update) return;

      applyUpdate(this.doc, base64ToBytes(payload.update), serverUpdateOrigin);
    });

    eventSource.addEventListener('room-reset', (event) => {
      const payload = JSON.parse(event.data) as RoomResetEventPayload;
      if (payload.roomId === this.roomId) {
        this.emitStatus('room reset');
        this.emitSync(false);
      }
    });

    eventSource.addEventListener('document-update', (event) => {
      const payload = JSON.parse(event.data) as DocumentUpdateEventPayload;
      if (payload.clientID === this.doc.clientID) return;

      applyUpdate(this.doc, base64ToBytes(payload.update), serverUpdateOrigin);
    });

    eventSource.addEventListener('awareness', (event) => {
      const payload = JSON.parse(event.data) as AwarenessEventPayload;
      this.awareness.applyRemoteStates(payload.states);
    });

    eventSource.addEventListener('error', () => {
      this.emitStatus('reconnecting');
      this.emitSync(false);
    });

    eventSource.addEventListener('open', () => {
      this.emitStatus('connected');
      this.emitSync(true);
    });
  }

  private async publishDocumentUpdate(update: Uint8Array) {
    await postDocumentUpdate(this.roomId, this.doc.clientID, bytesToBase64(update));
  }

  private readonly publishAwareness = (state: null | UserState) => {
    if (!this.connected) return;

    void postAwarenessUpdate(
      this.roomId,
      this.doc.clientID,
      state ? serializeUserState(state) : null,
    ).catch((error: unknown) => {
      console.error(error);
      this.emitStatus('error');
    });
  };
}
