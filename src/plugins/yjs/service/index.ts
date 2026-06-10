import type { Binding, Provider, UserState } from '@lexical/yjs';
import type { Doc } from 'yjs';

import type { IServiceID } from '@/types';

export interface YjsAwarenessUser {
  clientId: number;
  state: UserState;
}

export interface YjsPluginState {
  binding: Binding;
  doc: Doc | undefined;
  docMap: Map<string, Doc>;
  id: string;
  provider: Provider;
}

type YjsPluginStateListener = (state: YjsPluginState | null) => void;
type YjsAwarenessUsersListener = (users: YjsAwarenessUser[]) => void;

export class YjsService {
  private awarenessUsers: YjsAwarenessUser[] = [];
  private awarenessUsersListeners = new Set<YjsAwarenessUsersListener>();
  private listeners = new Set<YjsPluginStateListener>();
  private state: YjsPluginState | null = null;

  getAwarenessUsers(): YjsAwarenessUser[] {
    return this.awarenessUsers;
  }

  getState(): YjsPluginState | null {
    return this.state;
  }

  setAwarenessUsers(users: YjsAwarenessUser[]): void {
    this.awarenessUsers = users;
    this.awarenessUsersListeners.forEach((listener) => listener(users));
  }

  setState(state: YjsPluginState | null): void {
    this.state = state;
    this.listeners.forEach((listener) => listener(state));
  }

  subscribeAwarenessUsers(listener: YjsAwarenessUsersListener): () => void {
    this.awarenessUsersListeners.add(listener);
    listener(this.awarenessUsers);

    return () => {
      this.awarenessUsersListeners.delete(listener);
    };
  }

  subscribe(listener: YjsPluginStateListener): () => void {
    this.listeners.add(listener);
    listener(this.state);

    return () => {
      this.listeners.delete(listener);
    };
  }
}

export const IYjsService: IServiceID<YjsService> = {
  __serviceId: 'YjsService',
};
