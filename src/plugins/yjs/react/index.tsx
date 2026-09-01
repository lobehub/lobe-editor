'use client';

import {
  type BaseBinding,
  type ExcludedProperties,
  initLocalState,
  type Provider,
  setLocalStateFocus,
  syncCursorPositions,
  type SyncCursorPositionsFn,
  type UserState,
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
import type { ILocaleKeys } from '@/types';

import { createCodemirrorEditLockProvider } from './codemirrorEditLockProvider';

export interface ReactYjsPluginProps {
  awarenessData?: object;
  awarenessLabelFormatter?: AwarenessCursorLabelFormatter;
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

export interface AwarenessCursorLabelInput {
  name: string;
  role?: string;
  state: UserState;
  status?: string;
}

export interface AwarenessCursorLabel {
  label: string;
  loading?: boolean;
}

export type AwarenessCursorLabelFormatter = (
  input: AwarenessCursorLabelInput,
) => AwarenessCursorLabel | string;

export type AwarenessCursorLabelTranslationKey =
  | 'collaboration.aiAgent'
  | 'collaboration.aiAgentAwaitingReview'
  | 'collaboration.aiAgentConnecting'
  | 'collaboration.aiAgentSyncing'
  | 'collaboration.aiAgentThinking'
  | 'collaboration.aiAgentWriting';

const DEFAULT_AWARENESS_LABELS: Record<AwarenessCursorLabelTranslationKey, string> = {
  'collaboration.aiAgent': 'AI Agent',
  'collaboration.aiAgentAwaitingReview': 'AI Agent (awaiting review…)',
  'collaboration.aiAgentConnecting': 'AI Agent (connecting…)',
  'collaboration.aiAgentSyncing': 'AI Agent (syncing…)',
  'collaboration.aiAgentThinking': 'AI Agent (thinking…)',
  'collaboration.aiAgentWriting': 'AI Agent (typing…)',
};

const ACTIVE_AGENT_STATUSES = new Set([
  'awaiting-review',
  'connecting',
  'syncing',
  'thinking',
  'writing',
]);

/**
 * Format an awareness label without changing ordinary collaborator names.
 * Hosts can supply a translator to render the same status in their locale.
 */
export const formatAwarenessCursorLabel = (
  input: AwarenessCursorLabelInput,
  translate: (key: AwarenessCursorLabelTranslationKey) => string = (key) =>
    DEFAULT_AWARENESS_LABELS[key],
): AwarenessCursorLabel => {
  if (input.role !== 'agent') return { label: input.name, loading: false };

  const keyByStatus: Partial<
    Record<NonNullable<AwarenessCursorLabelInput['status']>, AwarenessCursorLabelTranslationKey>
  > = {
    'awaiting-review': 'collaboration.aiAgentAwaitingReview',
    'connecting': 'collaboration.aiAgentConnecting',
    'syncing': 'collaboration.aiAgentSyncing',
    'thinking': 'collaboration.aiAgentThinking',
    'writing': 'collaboration.aiAgentWriting',
  };
  const status = input.status;
  const key = status ? keyByStatus[status] : undefined;

  return {
    label: translate(key ?? 'collaboration.aiAgent'),
    loading: status !== undefined && ACTIVE_AGENT_STATUSES.has(status),
  };
};

const getAwarenessStableClientId = (state: UserState): number | undefined => {
  const clientId = (state as UserState & { clientId?: unknown }).clientId;
  return typeof clientId === 'number' && Number.isSafeInteger(clientId) ? clientId : undefined;
};

const getAwarenessRoleAndStatus = (state: UserState): { role?: string; status?: string } => {
  const data = state.awarenessData;
  if (!data || typeof data !== 'object') return {};
  const record = data as { role?: unknown; status?: unknown };
  return {
    ...(typeof record.role === 'string' ? { role: record.role } : {}),
    ...(typeof record.status === 'string' ? { status: record.status } : {}),
  };
};

/** Filter local/done Agent states before @lexical/yjs renders cursor overlays. */
export const getRenderableAwarenessStates = (
  binding: BaseBinding,
  provider: Provider,
  states: Map<number, UserState> = provider.awareness.getStates(),
): Map<number, UserState> => {
  const localState = provider.awareness.getLocalState();
  const localStableClientId = localState ? getAwarenessStableClientId(localState) : undefined;
  const renderable = new Map<number, UserState>();

  states.forEach((state, clientId) => {
    if (
      clientId === binding.clientID ||
      (localStableClientId !== undefined &&
        getAwarenessStableClientId(state) === localStableClientId)
    ) {
      return;
    }

    const { role, status } = getAwarenessRoleAndStatus(state);
    if (role === 'agent' && (status === 'done' || status === 'error')) return;
    renderable.set(clientId, state);
  });

  return renderable;
};

const AGENT_CURSOR_STYLE_ID = 'lobe-yjs-agent-cursor-styles';

const ensureAgentCursorStyles = (): void => {
  if (typeof document === 'undefined' || document.getElementById(AGENT_CURSOR_STYLE_ID)) return;

  const style = document.createElement('style');
  style.id = AGENT_CURSOR_STYLE_ID;
  style.textContent = `
    @keyframes lobe-yjs-agent-loading-dot {
      0%, 100% { opacity: .28; transform: scale(.82); }
      50% { opacity: 1; transform: scale(1); }
    }
    .lobe-yjs-agent-loading-dot {
      display: inline-block;
      margin-left: 3px;
      animation: lobe-yjs-agent-loading-dot 1.1s ease-in-out infinite;
    }
  `;
  document.head.append(style);
};

const updateAwarenessCursorLabels = (
  binding: BaseBinding,
  states: Map<number, UserState>,
  formatter: AwarenessCursorLabelFormatter,
): void => {
  if (typeof document === 'undefined') return;

  states.forEach((state, clientId) => {
    const cursor = binding.cursors.get(clientId) as
      | {
          name: string;
          selection?: { name?: HTMLSpanElement } | null;
        }
      | undefined;
    if (!cursor) return;

    const { role, status } = getAwarenessRoleAndStatus(state);
    const formatted = formatter({ name: state.name, role, state, status });
    const label = typeof formatted === 'string' ? { label: formatted, loading: false } : formatted;
    const stateKey = `${label.label}\u0000${label.loading ? '1' : '0'}\u0000${status ?? ''}`;
    cursor.name = label.label;
    const nameElement = cursor.selection?.name;
    if (!nameElement) return;
    if (nameElement.dataset.lobeYjsLabelState === stateKey) return;
    nameElement.dataset.lobeYjsLabelState = stateKey;
    if (role === 'agent') nameElement.dataset.lobeYjsAgentStatus = status ?? '';
    else delete nameElement.dataset.lobeYjsAgentStatus;
    nameElement.textContent = label.label;

    if (label.loading) {
      ensureAgentCursorStyles();
      const dot = document.createElement('span');
      dot.className = 'lobe-yjs-agent-loading-dot';
      dot.setAttribute('aria-hidden', 'true');
      dot.textContent = '•';
      nameElement.append(dot);
    }
  });
};

/**
 * Decorate the stock Yjs cursor projection with stable self-filtering and
 * role/status-aware Agent labels. The underlying selection/caret geometry is
 * still owned by @lexical/yjs, so an Agent caret moves with real awareness
 * RelativePositions rather than a DOM-only animation.
 */
export const createStatusAwareSyncCursorPositions =
  (
    syncFn: SyncCursorPositionsFn,
    formatter: AwarenessCursorLabelFormatter,
  ): SyncCursorPositionsFn =>
  (binding, provider, options) => {
    const sourceStates = options?.getAwarenessStates
      ? options.getAwarenessStates(binding, provider)
      : provider.awareness.getStates();
    const renderableStates = getRenderableAwarenessStates(binding, provider, sourceStates);
    syncFn(binding, provider, {
      ...options,
      getAwarenessStates: () => renderableStates,
    });
    updateAwarenessCursorLabels(binding, renderableStates, formatter);
  };

const DEFAULT_STALE_CURSOR_RETRIES = 2;
const STALE_CURSOR_RETRY_COOLDOWN_MS = 250;
const CURSOR_ERROR_REPORT_COOLDOWN_MS = 1000;

type CursorRetryScheduler = (callback: () => void) => number;
type CursorRetryCanceller = (handle: number) => void;

export interface SafeCursorSyncOptions {
  cancelRetry?: CursorRetryCanceller;
  maxStaleRetries?: number;
  now?: () => number;
  reportError?: (error: unknown) => void;
  scheduleRetry?: CursorRetryScheduler;
}

export interface SafeCursorSyncController {
  dispose: () => void;
  sync: SyncCursorPositionsFn;
}

type CursorFrameScheduler = (callback: () => void) => number;
type CursorFrameCanceller = (handle: number) => void;

export interface CursorFrameLoopController {
  start: () => void;
  stop: () => void;
}

/**
 * Run cursor layout work continuously while keeping the next frame in a
 * `finally` block. Browsers pause RAF delivery for background tabs; when the
 * tab becomes visible again, one stale Lexical read must not end the loop.
 */
export const createCursorFrameLoop = (
  callback: () => void,
  scheduleFrame: CursorFrameScheduler = (next) => window.requestAnimationFrame(() => next()),
  cancelFrame: CursorFrameCanceller = (handle) => window.cancelAnimationFrame(handle),
): CursorFrameLoopController => {
  let active = false;
  let pendingFrame: number | null = null;

  const schedule = (): void => {
    if (!active) return;

    pendingFrame = scheduleFrame(() => {
      pendingFrame = null;
      if (!active) return;

      try {
        callback();
      } finally {
        schedule();
      }
    });
  };

  return {
    start: () => {
      if (active) return;
      active = true;
      schedule();
    },
    stop: () => {
      active = false;
      if (pendingFrame !== null) {
        cancelFrame(pendingFrame);
        pendingFrame = null;
      }
    },
  };
};

const isStaleCursorSyncError = (error: unknown): boolean =>
  error instanceof Error &&
  error.message.includes('Lexical node does not exist in active editor state');

/**
 * Keep awareness notifications from escaping while Lexical is committing a
 * remote Yjs update. The stock cursor projection reads the current Lexical
 * node map and DOM synchronously; during that small window it can observe a
 * stale node and throw. A bounded animation-frame retry lets the commit land
 * without allowing one exception to kill the ReactYjsPlugin RAF loop.
 */
export const createSafeCursorSync = (
  syncFn: SyncCursorPositionsFn,
  options: SafeCursorSyncOptions = {},
): SafeCursorSyncController => {
  const scheduleRetry =
    options.scheduleRetry ??
    ((callback: () => void) => window.requestAnimationFrame(() => callback()));
  const cancelRetry =
    options.cancelRetry ?? ((handle: number) => window.cancelAnimationFrame(handle));
  const now = options.now ?? (() => Date.now());
  const reportError =
    options.reportError ??
    ((error: unknown) => {
      console.error('[lobe-editor] Failed to synchronize collaborative cursor.', error);
    });
  const maxStaleRetries = Math.max(0, options.maxStaleRetries ?? DEFAULT_STALE_CURSOR_RETRIES);

  let disposed = false;
  let pendingRetry: number | null = null;
  let staleRetryCount = 0;
  let staleRetryBlockedUntil = 0;
  let lastReportedAt = Number.NEGATIVE_INFINITY;

  const reportNonStaleError = (error: unknown): void => {
    const timestamp = now();
    if (timestamp - lastReportedAt < CURSOR_ERROR_REPORT_COOLDOWN_MS) return;
    lastReportedAt = timestamp;
    // Report outside the awareness/update callback so a provider event cannot
    // turn an incidental cursor failure into an unhandled provider exception.
    queueMicrotask(() => {
      if (!disposed) reportError(error);
    });
  };

  const sync = (
    binding: Parameters<SyncCursorPositionsFn>[0],
    provider: Provider,
    syncOptions?: Parameters<SyncCursorPositionsFn>[2],
  ): void => {
    if (disposed) return;

    try {
      syncFn(binding, provider, syncOptions);
      staleRetryCount = 0;
      staleRetryBlockedUntil = 0;
    } catch (error) {
      if (!isStaleCursorSyncError(error)) {
        reportNonStaleError(error);
        return;
      }

      // A retry is already waiting for the next DOM commit. Ignore the
      // duplicate RAF/awareness trigger instead of spending another attempt.
      if (pendingRetry !== null) return;

      const timestamp = now();
      if (timestamp < staleRetryBlockedUntil) return;
      if (staleRetryCount >= maxStaleRetries) {
        // The regular RAF loop remains alive. Throttle a later retry window so
        // a persistently malformed/stale awareness state cannot create a
        // 60fps exception/retry storm.
        staleRetryCount = 0;
        staleRetryBlockedUntil = timestamp + STALE_CURSOR_RETRY_COOLDOWN_MS;
        return;
      }

      staleRetryCount += 1;
      pendingRetry = scheduleRetry(() => {
        pendingRetry = null;
        sync(binding, provider, syncOptions);
      });
    }
  };

  return {
    dispose: () => {
      disposed = true;
      if (pendingRetry !== null) {
        cancelRetry(pendingRetry);
        pendingRetry = null;
      }
    },
    sync,
  };
};

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
  awarenessLabelFormatter,
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
  const resolvedAwarenessLabelFormatter = useMemo<AwarenessCursorLabelFormatter>(
    () =>
      awarenessLabelFormatter ??
      ((input) => formatAwarenessCursorLabel(input, (key) => editor.t(key as keyof ILocaleKeys))),
    [awarenessLabelFormatter, editor],
  );
  const statusAwareSyncCursorPositions = useMemo(
    () =>
      createStatusAwareSyncCursorPositions(syncCursorPositionsFn, resolvedAwarenessLabelFormatter),
    [resolvedAwarenessLabelFormatter, syncCursorPositionsFn],
  );
  const safeCursorSync = useMemo(
    () => createSafeCursorSync(statusAwareSyncCursorPositions),
    [statusAwareSyncCursorPositions],
  );

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

      safeCursorSync.sync(state.binding, state.provider);
    };

    awareness.on('update', updateAwareness);
    const unregisterUpdate = lexicalEditor.registerUpdateListener(updateAwareness);
    // Keep remote cursor overlays aligned across scroll/layout/font changes.
    const cursorFrameLoop = createCursorFrameLoop(updateAwareness);
    cursorFrameLoop.start();

    return () => {
      safeCursorSync.dispose();
      awareness.setLocalState = setLocalState;
      awareness.off('update', updateAwareness);
      unregisterUpdate();
      cursorFrameLoop.stop();
    };
  }, [
    awarenessData,
    cursorColor,
    lexicalEditor,
    persistCursorOnBlur,
    safeCursorSync,
    state,
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
      syncCursorPositionsFn={safeCursorSync.sync}
    />
  );
};

export { type Doc } from 'yjs';
