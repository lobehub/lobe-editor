// @vitest-environment jsdom
import { Activity, act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ kernel: null as any }));
vi.mock('@/editor-kernel/react/react-context', () => ({
  useLexicalComposerContext: () => [mocks.kernel],
}));

import { ReactYjsPlugin } from '../index';

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

describe('ReactYjsPlugin cursor effect lifecycle', () => {
  let host: HTMLDivElement;
  let editorRoot: HTMLDivElement;
  let view: ReturnType<typeof createRoot>;
  let state: any;
  let localState: any;
  let revision: number;
  let sync: ReturnType<typeof vi.fn>;
  const listeners = new Set<() => void>();
  const providerFactory = () => state.provider;

  beforeEach(() => {
    host = document.createElement('div');
    editorRoot = document.createElement('div');
    host.append(editorRoot);
    document.body.append(host);
    view = createRoot(editorRoot);
    revision = 1;
    localState = null;
    listeners.clear();
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation(() => 1);
    vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => {});
    const lexical = {
      getRootElement: () => editorRoot,
      registerCommand: () => () => {},
      registerUpdateListener: () => () => {},
    };
    const provider = {
      awareness: {
        getLocalState: () => localState,
        getStates: () => new Map(),
        off: (_event: string, listener: () => void) => listeners.delete(listener),
        on: (_event: string, listener: () => void) => listeners.add(listener),
        setLocalState: (value: unknown) => {
          localState = value;
        },
      },
    };
    state = {
      binding: { clientID: 1, cursors: new Map(), cursorsContainer: null, editor: lexical },
      provider,
    };
    mocks.kernel = {
      getLexicalEditor: () => lexical,
      registerPlugin: () => {},
      requireService: (id: { __serviceId: string }) =>
        id.__serviceId === 'YjsService'
          ? {
              subscribe: (listener: (value: unknown) => void) => {
                listener(state);
                return () => {};
              },
            }
          : undefined,
      t: (key: string) => key,
    };
    sync = vi.fn((binding) => {
      if (binding.cursorsContainer) binding.cursorsContainer.textContent = `cursor-${revision}`;
    });
  });

  afterEach(async () => {
    await act(async () => view.unmount());
    host.remove();
    vi.restoreAllMocks();
  });

  const render = async (version: number, mode: 'visible' | 'hidden' = 'visible') => {
    await act(async () =>
      view.render(
        <Activity mode={mode}>
          <ReactYjsPlugin
            awarenessData={{ userId: 'human', version }}
            id="room"
            providerFactory={providerFactory as never}
            syncCursorPositionsFn={sync as never}
          />
        </Activity>,
      ),
    );
  };

  it('keeps the renderer live when awareness config changes', async () => {
    await render(1);
    expect(sync).toHaveBeenCalled();
    sync.mockClear();
    revision = 2;
    await render(2);
    await act(async () => {
      listeners.forEach((listener) => listener());
    });
    expect(sync).toHaveBeenCalled();
    expect(state.binding.cursorsContainer?.textContent).toBe('cursor-2');
  });

  it('recreates the renderer after Activity hides and restores the editor', async () => {
    await render(1);
    await render(1, 'hidden');
    sync.mockClear();
    revision = 2;
    await render(1, 'visible');
    await act(async () => {
      listeners.forEach((listener) => listener());
    });
    expect(sync).toHaveBeenCalled();
    expect(state.binding.cursorsContainer?.textContent).toBe('cursor-2');
  });
});
