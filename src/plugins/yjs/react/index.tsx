'use client';

import {
  type ExcludedProperties,
  type SyncCursorPositionsFn,
  initLocalState,
  setLocalStateFocus,
  syncCursorPositions,
} from '@lexical/yjs';
import { BLUR_COMMAND, COMMAND_PRIORITY_EDITOR, FOCUS_COMMAND, type LexicalEditor } from 'lexical';
import type { FC, RefObject } from 'react';
import { useEffect, useLayoutEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import type { Doc } from 'yjs';

import { useLexicalEditor } from '@/editor-kernel/react';
import { useLexicalComposerContext } from '@/editor-kernel/react/react-context';
import {
  type YjsInitialEditorState,
  YjsPlugin,
  type YjsProviderFactory,
} from '@/plugins/yjs/plugin';
import { IYjsService, type YjsPluginState } from '@/plugins/yjs/service';

export interface ReactYjsPluginProps {
  awarenessData?: object;
  cursorColor?: string;
  cursorsContainerRef?: RefObject<HTMLElement | null>;
  excludedProperties?: ExcludedProperties;
  id: string;
  initialEditorState?: YjsInitialEditorState;
  providerFactory: YjsProviderFactory;
  shouldBootstrap?: boolean;
  syncCursorPositionsFn?: SyncCursorPositionsFn;
  username?: string;
  yjsDoc?: Doc;
}

const DEFAULT_CURSOR_COLOR = '#2563eb';
const DEFAULT_USERNAME = 'Anonymous';

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
  syncCursorPositionsFn,
  state,
}: {
  cursorsContainerRef?: RefObject<HTMLElement | null>;
  state: YjsPluginState;
  syncCursorPositionsFn: SyncCursorPositionsFn;
}) {
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
          zIndex: 1000,
        }}
      />,
      (cursorsContainerRef && cursorsContainerRef.current) || document.body,
    );
  }, [cursorsContainerRef, state.binding, state.provider, syncCursorPositionsFn]);

  return portal;
}

export const ReactYjsPlugin: FC<ReactYjsPluginProps> = ({
  awarenessData = {},
  cursorColor = DEFAULT_CURSOR_COLOR,
  cursorsContainerRef,
  excludedProperties,
  id,
  initialEditorState,
  providerFactory,
  shouldBootstrap,
  syncCursorPositionsFn = syncCursorPositions,
  username = DEFAULT_USERNAME,
  yjsDoc,
}) => {
  const [editor] = useLexicalComposerContext();
  const [lexicalEditor, setLexicalEditor] = useState<LexicalEditor | null>(null);
  const [pluginRegisteredSignal, setPluginRegisteredSignal] = useState(0);
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

    initLocalState(
      state.provider,
      username,
      cursorColor,
      document.activeElement === lexicalEditor.getRootElement(),
      awarenessData,
    );

    const updateAwareness = () => {
      syncCursorPositionsFn(state.binding, state.provider);
    };

    state.provider.awareness.on('update', updateAwareness);
    const unregisterUpdate = lexicalEditor.registerUpdateListener(updateAwareness);
    let animationFrame = 0;

    // Keep remote cursor overlays aligned across scroll/layout/font changes.
    const renderCursorPositions = () => {
      updateAwareness();
      animationFrame = window.requestAnimationFrame(renderCursorPositions);
    };

    animationFrame = window.requestAnimationFrame(renderCursorPositions);

    return () => {
      state.provider.awareness.off('update', updateAwareness);
      unregisterUpdate();
      window.cancelAnimationFrame(animationFrame);
    };
  }, [awarenessData, cursorColor, lexicalEditor, state, syncCursorPositionsFn, username]);

  useEffect(() => {
    if (!lexicalEditor || !state) {
      return;
    }

    const setFocus = (focusing: boolean) => {
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
  }, [awarenessData, cursorColor, lexicalEditor, state, username]);

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

  if (!state) {
    return null;
  }

  return (
    <YjsCursors
      cursorsContainerRef={cursorsContainerRef}
      state={state}
      syncCursorPositionsFn={syncCursorPositionsFn}
    />
  );
};

export { type Doc } from 'yjs';
