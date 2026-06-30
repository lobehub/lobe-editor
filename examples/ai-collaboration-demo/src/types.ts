import type { UserState } from '@lexical/yjs';

export interface PageMetadata {
  id: string;
  title: string;
  workspaceId: string;
}

export interface PageResponse {
  page: PageMetadata;
  roomId: string;
}

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

export interface RoomSnapshot {
  awareness: Array<[number, SerializedUserState]>;
  hasContent: boolean;
  update: null | string;
}

export interface AwarenessEventPayload {
  states: Array<[number, SerializedUserState]>;
}

export interface DocumentUpdateEventPayload {
  clientID: number;
  reload?: boolean;
  update: string;
}

export interface DocumentSnapshotEventPayload {
  hasContent: boolean;
  update: null | string;
}

export interface RoomResetEventPayload {
  roomId: string;
}

export interface AiTaskRequest {
  prompt: string;
  selection?: AiSelectionRequest;
}

export interface AiTaskResponse {
  clientID: number;
  insertedText: string;
  ok: boolean;
  taskId: string;
}

export interface AiSelectionRequest {
  occurrenceIndex: number;
  selectedText: string;
}

export interface BusinessUser {
  color: string;
  id: string;
  name: string;
}

export type AwarenessState = UserState;
