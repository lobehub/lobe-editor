import type { Provider, SyncCursorPositionsFn, UserState } from '@lexical/yjs';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  createCursorFrameLoop,
  createSafeCursorSync,
  createStatusAwareSyncCursorPositions,
  formatAwarenessCursorLabel,
  getRenderableAwarenessStates,
  type AwarenessCursorLabelInput,
} from '../index';

const createAwareness = (localState: UserState | null, states: Map<number, UserState>) => ({
  getLocalState: () => localState,
  getStates: () => states,
  off: () => {},
  on: () => {},
  setLocalState: () => {},
  setLocalStateField: () => {},
});

const createProvider = (
  localState: UserState | null,
  states: Map<number, UserState>,
): Provider => ({
  awareness: createAwareness(localState, states),
  connect: () => {},
  disconnect: () => {},
  off: () => {},
  on: () => {},
});

const createState = (
  name: string,
  awarenessData: Record<string, unknown>,
  clientId?: number,
): UserState => ({
  anchorPos: null,
  awarenessData,
  color: '#2563eb',
  ...(clientId === undefined ? {} : { clientId }),
  focusPos: null,
  focusing: true,
  name,
});

type RealCursor = {
  color: string;
  name: string;
  selection: null | {
    anchor: { key: string; offset: number };
    caret: HTMLSpanElement;
    color: string;
    focus: { key: string; offset: number };
    name: HTMLSpanElement;
    selections: HTMLElement[];
  };
};

const createCursor = (name: HTMLSpanElement): RealCursor => ({
  color: '#9333ea',
  name: 'AI Agent',
  selection: {
    anchor: { key: 'runtime-anchor', offset: 0 },
    caret: document.createElement('span'),
    color: '#9333ea',
    focus: { key: 'runtime-focus', offset: 0 },
    name,
    selections: [],
  },
});

describe('status-aware Yjs cursor labels', () => {
  afterEach(() => {
    document.getElementById('lobe-yjs-agent-cursor-styles')?.remove();
  });

  it('keeps ordinary collaborator names, local self-filtering, Agent status labels, and loading dot', () => {
    const local = createState('Local Tester', { role: 'browser' }, 11);
    const states = new Map<number, UserState>([
      [77, local],
      [101, createState('AI Agent', { role: 'agent', status: 'thinking' }, 42)],
      [102, createState('Alice', { role: 'browser' }, 43)],
      [103, createState('Done Agent', { role: 'agent', status: 'done' }, 44)],
    ]);
    const provider = createProvider(local, states);
    const agentName = document.createElement('span');
    const agentCursor = createCursor(agentName);
    const binding = {
      clientID: 11,
      cursors: new Map([[101, agentCursor]]),
    } as never;
    const syncFn = vi.fn<SyncCursorPositionsFn>();
    const formatter = (input: AwarenessCursorLabelInput) =>
      formatAwarenessCursorLabel(input, (key) => {
        const labels: Record<string, string> = {
          'collaboration.aiAgent': 'AI Agent',
          'collaboration.aiAgentThinking': 'AI Agent（思考中…）',
          'collaboration.aiAgentWriting': 'AI Agent（正在输入…）',
        };
        return labels[key] ?? key;
      });
    const sync = createStatusAwareSyncCursorPositions(syncFn, formatter);

    sync(binding, provider);

    expect(getRenderableAwarenessStates(binding, provider)).toEqual(
      new Map([
        [101, states.get(101)],
        [102, states.get(102)],
      ]),
    );
    expect(syncFn).toHaveBeenCalledTimes(1);
    expect(agentName.textContent).toContain('AI Agent（思考中…）');
    expect(agentCursor.name).toBe('AI Agent（思考中…）');
    expect(agentName.querySelector('.lobe-yjs-agent-loading-dot')).not.toBeNull();
    expect(document.getElementById('lobe-yjs-agent-cursor-styles')).not.toBeNull();

    const browserInput = {
      name: 'Alice',
      role: 'browser',
      state: states.get(102)!,
      status: undefined,
    } satisfies AwarenessCursorLabelInput;
    expect(formatAwarenessCursorLabel(browserInput)).toEqual({ label: 'Alice', loading: false });
  });

  it('updates writing labels with the same real awareness caret path and removes done/error states', () => {
    const local = createState('Local Tester', { role: 'browser' }, 11);
    const agent = createState('AI Agent', { role: 'agent', status: 'thinking' }, 42);
    const states = new Map<number, UserState>([
      [11, local],
      [101, agent],
    ]);
    const provider = createProvider(local, states);
    const agentName = document.createElement('span');
    const agentCursor = createCursor(agentName);
    const binding = {
      clientID: 11,
      cursors: new Map([[101, agentCursor]]),
    } as never;
    let projected = new Map<number, UserState>();
    const syncFn = ((_, __, options) => {
      projected = options?.getAwarenessStates?.(binding, provider) ?? new Map();
      if (!projected.has(101)) {
        agentCursor.selection = null;
        agentName.remove();
      }
    }) satisfies SyncCursorPositionsFn;
    const sync = createStatusAwareSyncCursorPositions(syncFn, (input) =>
      formatAwarenessCursorLabel(input, (key) =>
        key === 'collaboration.aiAgentThinking'
          ? 'AI Agent（思考中…）'
          : key === 'collaboration.aiAgentWriting'
            ? 'AI Agent（正在输入…）'
            : 'AI Agent',
      ),
    );

    sync(binding, provider);
    expect(projected.has(101)).toBe(true);
    expect(agentName.textContent).toContain('AI Agent（思考中…）');
    expect(agentCursor.name).toBe('AI Agent（思考中…）');

    agent.awarenessData = { role: 'agent', status: 'writing' };
    sync(binding, provider);
    expect(projected.has(101)).toBe(true);
    expect(agentName.textContent).toContain('AI Agent（正在输入…）');
    expect(agentCursor.name).toBe('AI Agent（正在输入…）');

    // @lexical/yjs may recreate the selection wrapper after a remote cursor
    // moves. The cursor's canonical string and the fresh selection.name DOM
    // must both receive the current status label.
    const rebuiltName = document.createElement('span');
    agentCursor.selection = { ...agentCursor.selection!, name: rebuiltName };
    sync(binding, provider);
    expect(rebuiltName.textContent).toContain('AI Agent（正在输入…）');

    agent.awarenessData = { role: 'agent', status: 'done' };
    sync(binding, provider);
    expect(projected.has(101)).toBe(false);
    expect(agentName.isConnected).toBe(false);

    states.set(101, createState('AI Agent', { role: 'agent', status: 'error' }, 42));
    sync(binding, provider);
    expect(projected.has(101)).toBe(false);
  });

  it('retries a transient stale Lexical node on the next frame and renders the Agent cursor', () => {
    const local = createState('Local Tester', { role: 'browser' }, 11);
    const states = new Map<number, UserState>([
      [11, local],
      [101, createState('AI Agent', { role: 'agent', status: 'writing' }, 42)],
    ]);
    const provider = createProvider(local, states);
    const agentName = document.createElement('span');
    const agentCursor = createCursor(agentName);
    agentCursor.selection = null;
    const binding = {
      clientID: 11,
      cursors: new Map([[101, agentCursor]]),
    } as never;
    let attempts = 0;
    const retryCallbacks: Array<() => void> = [];
    const syncFn = ((_, __, options) => {
      attempts += 1;
      if (attempts === 1) {
        throw new Error('Lexical node does not exist in active editor state');
      }

      const renderable = options?.getAwarenessStates?.(binding, provider);
      if (renderable?.has(101)) {
        agentCursor.selection = {
          anchor: { key: 'runtime-anchor', offset: 0 },
          caret: document.createElement('span'),
          color: agentCursor.color,
          focus: { key: 'runtime-focus', offset: 0 },
          name: agentName,
          selections: [],
        };
      }
    }) satisfies SyncCursorPositionsFn;
    const safeSync = createSafeCursorSync(
      createStatusAwareSyncCursorPositions(syncFn, (input) =>
        formatAwarenessCursorLabel(input, (key) =>
          key === 'collaboration.aiAgentWriting' ? 'AI Agent（正在输入…）' : 'AI Agent',
        ),
      ),
      {
        scheduleRetry: (callback) => {
          retryCallbacks.push(callback);
          return retryCallbacks.length;
        },
      },
    );

    expect(() => safeSync.sync(binding, provider)).not.toThrow();
    expect(attempts).toBe(1);
    expect(retryCallbacks).toHaveLength(1);
    expect(agentCursor.selection).toBeNull();

    retryCallbacks.shift()?.();

    expect(attempts).toBe(2);
    expect(agentCursor.selection).not.toBeNull();
    expect(agentName.textContent).toContain('AI Agent（正在输入…）');
    safeSync.dispose();
  });

  it('keeps the RAF loop alive when a hidden-tab resume starts with a stale sync', () => {
    const pendingFrames: Array<() => void> = [];
    let nextFrameHandle = 0;
    const scheduleFrame = (callback: () => void) => {
      pendingFrames.push(callback);
      nextFrameHandle += 1;
      return nextFrameHandle;
    };
    const cancelFrame = vi.fn();
    let hidden = true;
    let syncAttempts = 0;
    const cursorFrameLoop = createCursorFrameLoop(
      () => {
        syncAttempts += 1;
        if (syncAttempts === 1) {
          throw new Error('Lexical node does not exist in active editor state');
        }
      },
      scheduleFrame,
      cancelFrame,
    );
    const flushVisibleFrame = () => {
      if (hidden) return;
      pendingFrames.shift()?.();
    };

    cursorFrameLoop.start();
    expect(pendingFrames).toHaveLength(1);
    flushVisibleFrame();
    expect(syncAttempts).toBe(0);

    hidden = false;
    expect(() => flushVisibleFrame()).toThrow('Lexical node does not exist in active editor state');
    // The first visible callback threw, but its finally block still queued the
    // next frame. That callback represents the post-commit retry opportunity.
    expect(pendingFrames).toHaveLength(1);
    flushVisibleFrame();
    expect(syncAttempts).toBe(2);
    expect(pendingFrames).toHaveLength(1);

    cursorFrameLoop.stop();
    expect(cancelFrame).toHaveBeenCalledWith(3);
  });
});
