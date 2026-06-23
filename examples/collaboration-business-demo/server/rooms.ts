import { Doc, applyUpdate, encodeStateAsUpdate } from 'yjs';

import { base64ToBytes, bytesToBase64 } from './codec';

export interface SerializedRelativePosition {
  assoc?: number;
  item?: {
    client: number;
    clock: number;
  };
  tname?: string;
  type?: {
    client: number;
    clock: number;
  };
}

export interface SerializedUserState {
  anchorPos: null | SerializedRelativePosition;
  awarenessData: Record<string, unknown>;
  color: string;
  focusPos: null | SerializedRelativePosition;
  focusing: boolean;
  name: string;
}

export interface RoomEventClient {
  clientID: number;
  send: (event: string, data: unknown) => void;
}

export interface DocumentUpdatePayload {
  clientID: number;
  update: string;
}

export interface AwarenessPayload {
  clientID: number;
  state: null | SerializedUserState;
}

interface RoomState {
  awareness: Map<number, SerializedUserState>;
  clients: Map<number, RoomEventClient>;
  doc: Doc;
  hasContent: boolean;
}

const rooms = new Map<string, RoomState>();

const getRoom = (roomId: string): RoomState => {
  const existing = rooms.get(roomId);
  if (existing) return existing;

  const room: RoomState = {
    awareness: new Map(),
    clients: new Map(),
    doc: new Doc(),
    hasContent: false,
  };

  rooms.set(roomId, room);
  return room;
};

const broadcast = (room: RoomState, event: string, data: unknown, excludeClientID?: number) => {
  for (const [clientID, client] of room.clients) {
    if (clientID !== excludeClientID) {
      client.send(event, data);
    }
  }
};

export const addClient = (roomId: string, client: RoomEventClient) => {
  const room = getRoom(roomId);
  room.clients.set(client.clientID, client);

  client.send('document-snapshot', {
    hasContent: room.hasContent,
    update: room.hasContent ? bytesToBase64(encodeStateAsUpdate(room.doc)) : null,
  });

  client.send('awareness', {
    states: Array.from(room.awareness.entries()),
  });
};

export const removeClient = (roomId: string, clientID: number) => {
  const room = getRoom(roomId);
  room.clients.delete(clientID);
  room.awareness.delete(clientID);

  broadcast(room, 'awareness', {
    states: Array.from(room.awareness.entries()),
  });
};

export const getSnapshot = (roomId: string) => {
  const room = getRoom(roomId);

  return {
    awareness: Array.from(room.awareness.entries()),
    hasContent: room.hasContent,
    update: room.hasContent ? bytesToBase64(encodeStateAsUpdate(room.doc)) : null,
  };
};

export const resetRoom = (roomId: string) => {
  const room = rooms.get(roomId);
  if (!room) return;

  rooms.delete(roomId);

  for (const client of room.clients.values()) {
    client.send('room-reset', {
      roomId,
    });
  }
};

export const applyDocumentUpdate = (roomId: string, payload: DocumentUpdatePayload) => {
  const room = getRoom(roomId);
  const update = base64ToBytes(payload.update);

  applyUpdate(room.doc, update);
  room.hasContent = true;

  broadcast(
    room,
    'document-update',
    {
      clientID: payload.clientID,
      update: payload.update,
    },
    payload.clientID,
  );
};

export const applyAwarenessUpdate = (roomId: string, payload: AwarenessPayload) => {
  const room = getRoom(roomId);

  if (payload.state) {
    room.awareness.set(payload.clientID, payload.state);
  } else {
    room.awareness.delete(payload.clientID);
  }

  broadcast(room, 'awareness', {
    states: Array.from(room.awareness.entries()),
  });
};
