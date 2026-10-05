// @vitest-environment jsdom
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ editor: null as any }));
vi.mock('@/editor-kernel/react', async () => {
  const { useEffect } = await import('react');
  return {
    useLexicalComposerContext: () => [mocks.editor],
    useLexicalEditor: (handler: (editor: unknown) => (() => void) | undefined, deps: unknown[]) => {
      useEffect(() => handler(mocks.editor.getLexicalEditor()), deps);
    },
  };
});

import { LoroPresencePlugin } from './LoroPresencePlugin';

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

describe('LoroPresencePlugin', () => {
  let host: HTMLDivElement;
  let editorRoot: HTMLDivElement;
  let first: HTMLSpanElement;
  let second: HTMLSpanElement;
  let reactMount: HTMLDivElement;
  let view: ReturnType<typeof createRoot>;
  let presenceListener: ((snapshot: unknown) => void) | undefined;
  let range: {
    collapsed: boolean;
    getBoundingClientRect: () => DOMRect;
    getClientRects: () => DOMRect[];
    setEnd: ReturnType<typeof vi.fn>;
    setStart: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    host = document.createElement('div');
    editorRoot = document.createElement('div');
    editorRoot.contentEditable = 'true';
    first = document.createElement('span');
    first.textContent = 'first';
    second = document.createElement('span');
    second.textContent = 'second';
    editorRoot.append(first, second);
    reactMount = document.createElement('div');
    host.append(editorRoot, reactMount);
    document.body.append(host);
    view = createRoot(reactMount);

    range = {
      collapsed: false,
      getBoundingClientRect: () =>
        ({
          bottom: 20,
          height: 10,
          left: 10,
          right: 30,
          top: 10,
          width: 20,
        }) as DOMRect,
      getClientRects: () => [
        {
          bottom: 20,
          height: 10,
          left: 10,
          right: 30,
          top: 10,
          width: 20,
        } as DOMRect,
      ],
      setEnd: vi.fn(),
      setStart: vi.fn(),
    };
    vi.spyOn(document, 'createRange').mockReturnValue(range as unknown as Range);

    const snapshot = {
      peerId: 'peer-2',
      sender: 'sender-2',
      sequence: 1,
      state: {
        anchor: { cursor: 'anchor' },
        focus: { cursor: 'focus' },
        state: { color: '#c026d3', name: 'Agent' },
      },
    };
    const lexicalEditor = {
      getElementByKey: (key: string) =>
        key === 'first' ? first : key === 'second' ? second : null,
      getRootElement: () => editorRoot,
      registerUpdateListener: () => () => {},
    };
    const service = {
      resolvePoints: () => ({
        // A backwards selection: the anchor is after the focus in document order.
        anchor: { key: 'second', offset: 2, type: 'text' },
        focus: { key: 'first', offset: 1, type: 'text' },
      }),
      subscribeReadiness: (listener: (readiness: string) => void) => {
        listener('ready');
        return () => {};
      },
      transport: {
        getPresence: () => [snapshot],
        onPresence: (listener: (next: unknown) => void) => {
          presenceListener = listener;
          return () => {
            presenceListener = undefined;
          };
        },
        onStatus: () => () => {},
        peerId: 'local-peer',
      },
    };
    mocks.editor = {
      getLexicalEditor: () => lexicalEditor,
      requireService: () => service,
      t: (key: string) =>
        ({
          'collaboration.aiAgent': 'AI Agent',
          'collaboration.aiAgentThinking': 'AI Agent (thinking…)',
          'collaboration.aiAgentWriting': 'AI Agent (typing…)',
        })[key] ?? key,
    };
  });

  afterEach(async () => {
    await act(async () => view.unmount());
    host.remove();
    document.getElementById('lobe-collaboration-agent-cursor-styles')?.remove();
    vi.restoreAllMocks();
    presenceListener = undefined;
  });

  it('sorts backward selections for a DOM range while keeping the overlay outside Lexical root', async () => {
    await act(async () => view.render(<LoroPresencePlugin />));

    expect(range.setStart).toHaveBeenCalledWith(first.firstChild, 1);
    expect(range.setEnd).toHaveBeenCalledWith(second.firstChild, 2);
    expect(editorRoot.querySelector('[data-loro-presence-layer]')).toBeNull();
    const layer = host.querySelector('[data-loro-presence-layer]');
    expect(layer).toBeTruthy();
    expect(layer?.parentElement).toBe(host);
    expect(layer?.querySelector('[data-loro-presence-peer="peer-2"]')).toBeTruthy();
    expect(layer?.querySelectorAll('[data-loro-presence-label="peer-2"]')).toHaveLength(1);
  });

  it('renders one visible Agent label for a multi-rect selection and updates status in place', async () => {
    range.getClientRects = () => [
      {
        bottom: 20,
        height: 10,
        left: 10,
        right: 30,
        top: 10,
        width: 20,
      } as DOMRect,
      {
        bottom: 40,
        height: 10,
        left: 10,
        right: 30,
        top: 30,
        width: 20,
      } as DOMRect,
    ];

    await act(async () => view.render(<LoroPresencePlugin />));

    let layer = host.querySelector('[data-loro-presence-layer]');
    expect(layer?.querySelectorAll('[data-loro-presence-peer="peer-2"]')).toHaveLength(2);
    expect(layer?.querySelector('[data-loro-presence-label="peer-2"]')?.textContent).toBe('Agent');

    await act(async () =>
      presenceListener?.({
        peerId: 'peer-2',
        sender: 'sender-2',
        sequence: 2,
        state: {
          anchor: { cursor: 'anchor' },
          focus: { cursor: 'focus' },
          state: {
            color: '#c026d3',
            name: 'Rewrite Agent',
            role: 'agent',
            status: 'thinking',
          },
        },
      }),
    );

    layer = host.querySelector('[data-loro-presence-layer]');
    expect(layer?.querySelectorAll('[data-loro-presence-label="peer-2"]')).toHaveLength(1);
    expect(layer?.querySelector('[data-loro-presence-label="peer-2"]')?.textContent).toContain(
      'Rewrite Agent (thinking…)',
    );
    expect(
      layer?.querySelector(
        '[data-loro-presence-label="peer-2"] .lobe-collaboration-agent-loading-dot',
      ),
    ).toBeTruthy();

    await act(async () =>
      presenceListener?.({
        peerId: 'peer-2',
        sender: 'sender-2',
        sequence: 3,
        state: {
          anchor: { cursor: 'anchor' },
          focus: { cursor: 'focus' },
          state: {
            color: '#c026d3',
            name: 'Rewrite Agent',
            role: 'agent',
            status: 'writing',
          },
        },
      }),
    );
    expect(layer?.querySelector('[data-loro-presence-label="peer-2"]')?.textContent).toContain(
      'Rewrite Agent (typing…)',
    );

    await act(async () =>
      presenceListener?.({
        peerId: 'peer-2',
        sender: 'sender-2',
        sequence: 4,
        state: {
          anchor: { cursor: 'anchor' },
          focus: { cursor: 'focus' },
          state: {
            color: '#c026d3',
            name: 'Rewrite Agent',
            role: 'agent',
            status: 'done',
          },
        },
      }),
    );
    expect(layer?.querySelector('[data-loro-presence-label="peer-2"]')).toBeNull();

    await act(async () =>
      presenceListener?.({
        peerId: 'peer-2',
        sender: 'sender-2',
        sequence: 5,
        state: {
          anchor: { cursor: 'anchor' },
          focus: { cursor: 'focus' },
          state: {
            color: '#c026d3',
            name: 'Rewrite Agent',
            role: 'agent',
            status: 'error',
          },
        },
      }),
    );
    expect(layer?.querySelector('[data-loro-presence-label="peer-2"]')).toBeNull();
  });

  it('keeps a visible label beside a collapsed Agent caret', async () => {
    range.collapsed = true;
    range.getClientRects = () => [
      {
        bottom: 20,
        height: 10,
        left: 10,
        right: 10,
        top: 10,
        width: 0,
      } as DOMRect,
    ];

    await act(async () => view.render(<LoroPresencePlugin />));

    const layer = host.querySelector('[data-loro-presence-layer]');
    expect(layer?.querySelectorAll('[data-loro-presence-peer="peer-2"]')).toHaveLength(1);
    expect(layer?.querySelector('[data-loro-presence-label="peer-2"]')?.textContent).toBe('Agent');
  });

  it('tears down the sibling overlay and restores host positioning', async () => {
    host.style.position = '';
    await act(async () => view.render(<LoroPresencePlugin />));
    expect(host.style.position).toBe('relative');
    expect(host.querySelector('[data-loro-presence-layer]')).toBeTruthy();

    await act(async () => view.unmount());

    expect(host.querySelector('[data-loro-presence-layer]')).toBeNull();
    expect(host.style.position).toBe('');
  });
});
