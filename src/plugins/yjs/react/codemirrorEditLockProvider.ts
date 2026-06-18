import type { UserState } from '@lexical/yjs';

import type {
  CodemirrorEditLock,
  CodemirrorEditLockOwner,
  CodemirrorEditLockProvider,
} from '@/plugins/codemirror-block/service';
import type { YjsPluginState } from '@/plugins/yjs/service';

interface AwarenessDataWithLock {
  editingBlock?: CodemirrorEditLock | null;
}

function getAwarenessData(state: UserState | null): AwarenessDataWithLock {
  const awarenessData = state?.awarenessData;

  if (!awarenessData || typeof awarenessData !== 'object') {
    return {};
  }

  return awarenessData as AwarenessDataWithLock;
}

function getEditingBlock(state: UserState | null): CodemirrorEditLock | null {
  const editingBlock = getAwarenessData(state).editingBlock;

  return editingBlock && typeof editingBlock.key === 'string' ? editingBlock : null;
}

function updateLocalLock(state: YjsPluginState, key: string, nextLock: CodemirrorEditLock | null) {
  const localState = state.provider.awareness.getLocalState();

  if (!localState) {
    return;
  }

  const nextAwarenessData = {
    ...getAwarenessData(localState),
  };

  if (nextLock) {
    nextAwarenessData.editingBlock = nextLock;
  } else if (nextAwarenessData.editingBlock?.key === key) {
    delete nextAwarenessData.editingBlock;
  }

  state.provider.awareness.setLocalState({
    ...localState,
    awarenessData: nextAwarenessData,
  });
}

export function createCodemirrorEditLockProvider(
  state: YjsPluginState,
): CodemirrorEditLockProvider {
  const localClientId = state.binding.clientID;

  const getRemoteLockOwner = (key: string): CodemirrorEditLockOwner | null => {
    for (const [clientId, userState] of state.provider.awareness.getStates()) {
      if (clientId === localClientId) {
        continue;
      }

      const lock = getEditingBlock(userState);

      if (lock?.key === key) {
        return {
          id: clientId,
          lock,
          name: userState.name,
        };
      }
    }

    return null;
  };

  return {
    acquireLock: (key, label) => {
      if (getRemoteLockOwner(key)) {
        return false;
      }

      updateLocalLock(state, key, {
        key,
        label,
        updatedAt: Date.now(),
      });

      return true;
    },
    getRemoteLockOwner,
    releaseLock: (key) => {
      updateLocalLock(state, key, null);
    },
    subscribe: (listener) => {
      state.provider.awareness.on('update', listener);

      return () => {
        state.provider.awareness.off('update', listener);
      };
    },
  };
}
