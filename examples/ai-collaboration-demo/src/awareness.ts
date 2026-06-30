import type { ProviderAwareness, UserState } from '@lexical/yjs';
import { type RelativePosition, createRelativePositionFromJSON, relativePositionToJSON } from 'yjs';

import type { SerializedRelativePosition, SerializedUserState } from './types';

export const serializeRelativePosition = (
  position: null | RelativePosition,
): null | SerializedRelativePosition => {
  if (!position) return null;

  return relativePositionToJSON(position) as SerializedRelativePosition;
};

export const deserializeRelativePosition = (
  position: null | SerializedRelativePosition,
): null | RelativePosition => {
  if (!position) return null;

  return createRelativePositionFromJSON(position);
};

export const serializeUserState = (state: UserState): SerializedUserState => ({
  anchorPos: serializeRelativePosition(state.anchorPos),
  awarenessData: state.awarenessData as Record<string, unknown>,
  color: state.color,
  focusPos: serializeRelativePosition(state.focusPos),
  focusing: state.focusing,
  name: state.name,
});

export const deserializeUserState = (state: SerializedUserState): UserState => ({
  anchorPos: deserializeRelativePosition(state.anchorPos),
  awarenessData: state.awarenessData,
  color: state.color,
  focusPos: deserializeRelativePosition(state.focusPos),
  focusing: state.focusing,
  name: state.name,
});

export class BusinessAwareness implements ProviderAwareness {
  private localState: null | UserState = null;
  private readonly remoteStates = new Map<number, UserState>();
  private readonly updateListeners = new Set<() => void>();

  constructor(
    private readonly clientID: number,
    private readonly publishLocalState: (state: null | UserState) => void,
  ) {}

  applyRemoteStates(states: Array<[number, SerializedUserState]>) {
    this.remoteStates.clear();

    for (const [clientID, state] of states) {
      if (clientID !== this.clientID) {
        this.remoteStates.set(clientID, deserializeUserState(state));
      }
    }

    this.emitUpdate();
  }

  getLocalState = () => this.localState;

  getStates = () => {
    const states = new Map(this.remoteStates);

    if (this.localState) {
      states.set(this.clientID, this.localState);
    }

    return states;
  };

  off = (_type: 'update', callback: () => void) => {
    this.updateListeners.delete(callback);
  };

  on = (_type: 'update', callback: () => void) => {
    this.updateListeners.add(callback);
  };

  setLocalState = (state: null | UserState) => {
    this.localState = state;
    this.publishLocalState(state);
    this.emitUpdate();
  };

  setLocalStateField = (field: string, value: unknown) => {
    this.setLocalState({
      ...(this.localState ?? {
        anchorPos: null,
        awarenessData: {},
        color: '#1677ff',
        focusPos: null,
        focusing: true,
        name: 'Local collaborator',
      }),
      [field]: value,
    });
  };

  private emitUpdate() {
    for (const listener of this.updateListeners) {
      listener();
    }
  }
}
