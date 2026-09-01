'use client';

import {
  type ExcludedProperties,
  type SyncCursorPositionsFn,
  type UserState,
  initLocalState,
  setLocalStateFocus,
  syncCursorPositions,
} from '@lexical/yjs';
import { BLUR_COMMAND, COMMAND_PRIORITY_EDITOR, FOCUS_COMMAND, type LexicalEditor } from 'lexical';
import type { FC, RefObject } from 'react';
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { Doc } from 'yjs';

import { useLexicalEditor } from '@/editor-kernel/react';
import { useLexicalComposerContext } from '@/editor-kernel/react/react-context';
import { ICodemirrorEditLockService } from '@/plugins/codemirror-block/service';
import {
  type YjsInitialEditorState,
  YjsPlugin,
  type YjsProviderFactory,
} from '@/plugins/yjs/plugin';
import { IYjsService, type YjsPluginState } from '@/plugins/yjs/service';

import { createCodemirrorEditLockProvider } from './codemirrorEditLockProvider';

export interface ReactYjsPluginProps {
  awarenessData?: object;
  cursorColor?: string;
  cursorsContainerRef?: RefObject<HTMLElement | null>;
  excludedProperties?: ExcludedProperties;
  id: string;
  initialEditorState?: YjsInitialEditorState;
  persistCursorOnBlur?: boolean;
  providerFactory: YjsProviderFactory;
  shouldBootstrap?: boolean;
  syncCursorPositionsFn?: SyncCursorPositionsFn;
  username?: string;
  yjsDoc?: Doc;
}

const DEFAULT_CURSOR_COLOR = '#2563eb';
const DEFAULT_USERNAME = 'Anonymous';
const CURSOR_OVERLAY_Z_INDEX = 1;

type LocalSelectionState = Pick<UserState, 'anchorPos' | 'focusPos'>;

function useYjsState(
  lexicalEditor: LexicalEditor | null,
  pluginRegisteredSignal: number,
): YjsPluginState | null {
  const [editor] = useLexicalComposerContext();
  const [state, setState] = useState<YjsPluginState | null>(null);

  useEffect(() => {
    if (!lexicalEditor) {
      return;
    }

    return editor.requireService(IYjsService)?.subscribe(setState);
  }, [editor, lexicalEditor, pluginRegisteredSignal]);

  return state;
}

function YjsCursors({
  cursorsContainerRef,
  lexicalEditor,
  syncCursorPositionsFn,
  state,
}: {
  cursorsContainerRef?: RefObject<HTMLElement | null>;
  lexicalEditor: LexicalEditor;
  state: YjsPluginState;
  syncCursorPositionsFn: SyncCursorPositionsFn;
}) {
  const [defaultContainer, setDefaultContainer] = useState<HTMLElement | null>(null);
  const cursorsContainer = cursorsContainerRef?.current || defaultContainer || document.body;

  useLayoutEffect(() => {
    if (cursorsContainerRef?.current) {
      return;
    }

    const rootElement = lexicalEditor.getRootElement();
    setDefaultContainer(rootElement?.parentElement || rootElement || document.body);
  }, [cursorsContainerRef, lexicalEditor]);

  const portal = useMemo(() => {
    const ref = (element: HTMLElement | null) => {
      state.binding.cursorsContainer = element;

      if (element) {
        syncCursorPositionsFn(state.binding, state.provider);
      }
    };

    return createPortal(
      <div
        ref={ref}
        style={{
          height: 0,
          left: 0,
          pointerEvents: 'none',
          position: 'absolute',
          top: 0,
          width: 0,
          zIndex: CURSOR_OVERLAY_Z_INDEX,
        }}
      />,
      cursorsContainer,
    );
  }, [cursorsContainer, state.binding, state.provider, syncCursorPositionsFn]);

  return portal;
}

export const ReactYjsPlugin: FC<ReactYjsPluginProps> = ({
  awarenessData = {},
  cursorColor = DEFAULT_CURSOR_COLOR,
  cursorsContainerRef,
  excludedProperties,
  id,
  initialEditorState,
  persistCursorOnBlur = true,
  providerFactory,
  shouldBootstrap,
  syncCursorPositionsFn = syncCursorPositions,
  username = DEFAULT_USERNAME,
  yjsDoc,
}) => {
  const [editor] = useLexicalComposerContext();
  const [lexicalEditor, setLexicalEditor] = useState<LexicalEditor | null>(null);
  const [pluginRegisteredSignal, setPluginRegisteredSignal] = useState(0);
  const lastLocalSelectionRef = useRef<LocalSelectionState | null>(null);
  const state = useYjsState(lexicalEditor, pluginRegisteredSignal);

  useLayoutEffect(() => {
    editor.registerPlugin(YjsPlugin, {
      excludedProperties,
      id,
      initialEditorState,
      providerFactory,
      shouldBootstrap,
      yjsDoc,
    });
    setPluginRegisteredSignal((value) => value + 1);
  }, [
    editor,
    excludedProperties,
    id,
    initialEditorState,
    providerFactory,
    shouldBootstrap,
    yjsDoc,
  ]);

  useLexicalEditor((activeEditor) => {
    setLexicalEditor(activeEditor);

    return () => {
      setLexicalEditor(null);
    };
  }, []);

  useEffect(() => {
    if (!lexicalEditor || !state) {
      return;
    }

    const awareness = state.provider.awareness;
    const setLocalState = awareness.setLocalState.bind(awareness);

    const getLocalStateWithPreservedSelection = (localState: UserState | null) => {
      if (!localState) {
        lastLocalSelectionRef.current = null;
        return localState;
      }

      if (localState.anchorPos && localState.focusPos) {
        lastLocalSelectionRef.current = {
          anchorPos: localState.anchorPos,
          focusPos: localState.focusPos,
        };
        return localState;
      }

      if (!persistCursorOnBlur || !localState.focusing || !lastLocalSelectionRef.current) {
        return localState;
      }

      return {
        ...localState,
        anchorPos: lastLocalSelectionRef.current.anchorPos,
        focusPos: lastLocalSelectionRef.current.focusPos,
      };
    };

    awareness.setLocalState = (localState) => {
      setLocalState(getLocalStateWithPreservedSelection(localState));
    };

    initLocalState(
      state.provider,
      username,
      cursorColor,
      persistCursorOnBlur || document.activeElement === lexicalEditor.getRootElement(),
      awarenessData,
    );

    const updateAwareness = () => {
      const localState = awareness.getLocalState();
      const nextLocalState = getLocalStateWithPreservedSelection(localState);

      if (nextLocalState !== localState) {
        setLocalState(nextLocalState);
      }

      syncCursorPositionsFn(state.binding, state.provider);
    };

    awareness.on('update', updateAwareness);
    const unregisterUpdate = lexicalEditor.registerUpdateListener(updateAwareness);
    let animationFrame = 0;

    // Keep remote cursor overlays aligned across scroll/layout/font changes.
    const renderCursorPositions = () => {
      updateAwareness();
      animationFrame = window.requestAnimationFrame(renderCursorPositions);
    };

    animationFrame = window.requestAnimationFrame(renderCursorPositions);

    return () => {
      awareness.setLocalState = setLocalState;
      awareness.off('update', updateAwareness);
      unregisterUpdate();
      window.cancelAnimationFrame(animationFrame);
    };
  }, [
    awarenessData,
    cursorColor,
    lexicalEditor,
    persistCursorOnBlur,
    state,
    syncCursorPositionsFn,
    username,
  ]);

  useEffect(() => {
    if (!lexicalEditor || !state) {
      return;
    }

    const editLockService = editor.requireService(ICodemirrorEditLockService);

    return editLockService?.registerProvider(createCodemirrorEditLockProvider(state));
  }, [editor, lexicalEditor, state]);

  useEffect(() => {
    if (!lexicalEditor || !state) {
      return;
    }

    const setFocus = (focusing: boolean) => {
      if (!focusing && persistCursorOnBlur) {
        return false;
      }

      setLocalStateFocus(state.provider, username, cursorColor, focusing, awarenessData);
      return false;
    };

    const unregisterFocus = lexicalEditor.registerCommand(
      FOCUS_COMMAND,
      () => setFocus(true),
      COMMAND_PRIORITY_EDITOR,
    );
    const unregisterBlur = lexicalEditor.registerCommand(
      BLUR_COMMAND,
      () => setFocus(false),
      COMMAND_PRIORITY_EDITOR,
    );

    return () => {
      unregisterFocus();
      unregisterBlur();
    };
  }, [awarenessData, cursorColor, lexicalEditor, persistCursorOnBlur, state, username]);

  useEffect(() => {
    if (!state) {
      return;
    }

    const clearAwarenessState = () => {
      state.provider.awareness.setLocalState(null);
    };

    window.addEventListener('beforeunload', clearAwarenessState);
    window.addEventListener('pagehide', clearAwarenessState);

    return () => {
      window.removeEventListener('beforeunload', clearAwarenessState);
      window.removeEventListener('pagehide', clearAwarenessState);
      clearAwarenessState();
    };
  }, [state]);

  if (!lexicalEditor || !state) {
    return null;
  }

  return (
    <YjsCursors
      cursorsContainerRef={cursorsContainerRef}
      lexicalEditor={lexicalEditor}
      state={state}
      syncCursorPositionsFn={syncCursorPositionsFn}
    />
  );
};

export { type Doc } from 'yjs';
