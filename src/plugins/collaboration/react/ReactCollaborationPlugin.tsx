'use client';

import type { FC, MutableRefObject } from 'react';
import { useMemo, useRef } from 'react';
import { Doc } from 'yjs';

import { useLexicalEditor } from '@/editor-kernel/react';

import {
  getOrCreateYDoc,
  initializeCollaborationUser,
  registerCollaborationBinding,
} from '../utils';
import type { ReactCollaborationPluginProps } from './type';

const defaultYjsDocMap = new Map<string, Doc>();

type StatusChangeHandler = ReactCollaborationPluginProps['onStatusChange'];
type SyncHandler = ReactCollaborationPluginProps['onSync'];

const createProviderStatusHandler = (
  statusChangeRef: MutableRefObject<StatusChangeHandler | undefined>,
) => {
  return function handleProviderStatus({ status }: { status: string }) {
    statusChangeRef.current?.(status);
  };
};

const createProviderSyncHandler = (syncRef: MutableRefObject<SyncHandler | undefined>) => {
  return function handleProviderSync(isSynced: boolean) {
    syncRef.current?.(isSynced);
  };
};

const createCursorContainer = (rootElement: HTMLElement | null) => {
  const parentElement = rootElement?.parentElement;
  if (!rootElement || !parentElement) return null;

  const computedStyle = getComputedStyle(parentElement);
  if (computedStyle.position === 'static') {
    parentElement.style.position = 'relative';
  }

  const container = document.createElement('div');
  container.dataset.lobeEditorCollaborationCursors = 'true';
  container.style.inset = '0';
  container.style.pointerEvents = 'none';
  container.style.position = 'absolute';
  container.style.zIndex = '20';
  parentElement.append(container);

  return container;
};

export const ReactCollaborationPlugin: FC<ReactCollaborationPluginProps> = ({
  connect = true,
  cursorContainer,
  excludedProperties,
  id,
  onStatusChange,
  onSync,
  providerFactory,
  shouldBootstrap,
  syncCursorPositionsFn,
  user,
  yjsDocMap,
}) => {
  const statusChangeRef = useRef(onStatusChange);
  const syncRef = useRef(onSync);
  statusChangeRef.current = onStatusChange;
  syncRef.current = onSync;

  const docMap = useMemo(() => yjsDocMap ?? defaultYjsDocMap, [yjsDocMap]);

  useLexicalEditor(
    (lexicalEditor) => {
      let teardown: (() => void) | undefined;
      const timeoutId = setTimeout(() => {
        const doc = getOrCreateYDoc(id, docMap, () => new Doc());
        const provider = providerFactory(id, docMap);
        const effectiveDoc = docMap.get(id) ?? doc;
        const ownedCursorContainer =
          cursorContainer ?? createCursorContainer(lexicalEditor.getRootElement());

        initializeCollaborationUser(provider, user);

        const statusHandler = createProviderStatusHandler(statusChangeRef);
        const syncHandler = createProviderSyncHandler(syncRef);

        provider.on('status', statusHandler);
        provider.on('sync', syncHandler);

        const { cleanup } = registerCollaborationBinding({
          cursorContainer: ownedCursorContainer,
          doc: effectiveDoc,
          excludedProperties,
          id,
          lexicalEditor,
          provider,
          shouldBootstrap,
          syncCursorPositionsFn,
          yjsDocMap: docMap,
        });

        if (connect) {
          void provider.connect();
        }

        teardown = () => {
          cleanup();
          provider.off('status', statusHandler);
          provider.off('sync', syncHandler);
          provider.awareness.setLocalState(null);
          provider.disconnect();

          if (!cursorContainer) {
            ownedCursorContainer?.remove();
          }
        };
      }, 0);

      return () => {
        clearTimeout(timeoutId);
        teardown?.();
      };
    },
    [
      connect,
      cursorContainer,
      docMap,
      excludedProperties,
      id,
      providerFactory,
      shouldBootstrap,
      syncCursorPositionsFn,
      user,
    ],
  );

  return null;
};

ReactCollaborationPlugin.displayName = 'ReactCollaborationPlugin';

export default ReactCollaborationPlugin;
