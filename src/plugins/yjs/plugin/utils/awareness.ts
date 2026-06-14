import type { Provider, UserState } from '@lexical/yjs';

export function getAwarenessUsers(
  provider: Provider,
): Array<{ clientId: number; state: UserState }> {
  return Array.from(provider.awareness.getStates(), ([clientId, state]) => ({
    clientId,
    state,
  }));
}
