import { useCallback, useEffect, useState } from 'react';

import { useLexicalComposerContext } from '@/editor-kernel/react/react-context';

import { ICodemirrorEditLockService } from '../service';

export function useCodemirrorEditLock(key: string, label: string) {
  const [editor] = useLexicalComposerContext();
  const service = editor.requireService(ICodemirrorEditLockService);
  const [, setVersion] = useState(0);

  useEffect(() => {
    return service?.subscribe(() => {
      setVersion((value) => value + 1);
    });
  }, [service]);

  const remoteLockOwner = service?.getRemoteLockOwner(key) || null;

  const acquireLock = useCallback(() => {
    return service?.acquireLock(key, label) ?? true;
  }, [key, label, service]);

  const releaseLock = useCallback(() => {
    service?.releaseLock(key);
  }, [key, service]);

  return {
    acquireLock,
    isLockedByRemote: !!remoteLockOwner,
    lockOwnerName: remoteLockOwner?.name,
    releaseLock,
  };
}
