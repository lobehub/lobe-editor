import type { PageResponse, RoomSnapshot, SerializedUserState } from './types';

export const apiBase = '';

export const fetchPage = async (workspaceId: string, pageId: string) => {
  const response = await fetch(`${apiBase}/api/workspaces/${workspaceId}/pages/${pageId}`);

  if (!response.ok) {
    throw new Error(`Failed to fetch page metadata: ${response.status}`);
  }

  return response.json() as Promise<PageResponse>;
};

export const fetchRoomSnapshot = async (roomId: string) => {
  const response = await fetch(`${apiBase}/api/rooms/${encodeURIComponent(roomId)}/snapshot`);

  if (!response.ok) {
    throw new Error(`Failed to fetch room snapshot: ${response.status}`);
  }

  return response.json() as Promise<RoomSnapshot>;
};

export const postDocumentUpdate = async (roomId: string, clientID: number, update: string) => {
  const response = await fetch(`${apiBase}/api/rooms/${encodeURIComponent(roomId)}/update`, {
    body: JSON.stringify({
      clientID,
      update,
    }),
    headers: {
      'Content-Type': 'application/json',
    },
    method: 'POST',
  });

  if (!response.ok) {
    throw new Error(`Failed to post document update: ${response.status}`);
  }
};

export const postAwarenessUpdate = async (
  roomId: string,
  clientID: number,
  state: null | SerializedUserState,
) => {
  const response = await fetch(`${apiBase}/api/rooms/${encodeURIComponent(roomId)}/awareness`, {
    body: JSON.stringify({
      clientID,
      state,
    }),
    headers: {
      'Content-Type': 'application/json',
    },
    method: 'POST',
  });

  if (!response.ok) {
    throw new Error(`Failed to post awareness update: ${response.status}`);
  }
};

export const createRoomEventSource = (roomId: string, clientID: number) =>
  new EventSource(`${apiBase}/api/rooms/${encodeURIComponent(roomId)}/events?clientID=${clientID}`);

export const resetRoom = async (roomId: string) => {
  const response = await fetch(`${apiBase}/api/rooms/${encodeURIComponent(roomId)}`, {
    method: 'DELETE',
  });

  if (!response.ok) {
    throw new Error(`Failed to reset room: ${response.status}`);
  }
};
