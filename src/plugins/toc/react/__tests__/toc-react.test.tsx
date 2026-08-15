import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { IEditor } from '@/types';

import { TocPlugin } from '../../plugin';
import type { ITocService } from '../../service';
import type { TocItem } from '../../types';
import { ReactTocPlugin } from '../';
import { useToc } from '../useToc';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT =
  true;

describe('TOC React host integration', () => {
  let host: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    host = document.createElement('div');
    document.body.append(host);
    root = createRoot(host);
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    host.remove();
  });

  it('registers only the headless kernel plugin and renders no editor-owned UI', async () => {
    const registerPlugin = vi.fn();
    const editor = { registerPlugin } as unknown as IEditor;

    await act(async () => {
      root.render(
        <>
          <span data-testid="host-owned-toc" />
          <ReactTocPlugin editor={editor} maxDepth={4} minDepth={2} />
        </>,
      );
    });

    expect(registerPlugin).toHaveBeenCalledOnce();
    expect(registerPlugin).toHaveBeenCalledWith(TocPlugin, { maxDepth: 4, minDepth: 2 });
    expect(host.children).toHaveLength(1);
    expect(host.firstElementChild?.getAttribute('data-testid')).toBe('host-owned-toc');
  });

  it('lets the host render and control an external TOC through useToc', async () => {
    let activeKey: null | string = null;
    let items: TocItem[] = [
      {
        children: [],
        depth: 2,
        key: 'heading-a',
        tag: 'h2',
        title: 'Host rendered heading',
      },
    ];
    const listeners = new Set<() => void>();
    const emitChange = () => {
      for (const listener of listeners) listener();
    };
    const setActiveKey = vi.fn((key: null | string) => {
      if (activeKey === key) return;
      activeKey = key;
      emitChange();
    });
    const service = {
      getActiveKey: () => activeKey,
      getFlatItems: () => items,
      getItems: () => items,
      jumpTo: vi.fn(() => true),
      refresh: vi.fn(() => items),
      setActiveKey,
      setDepthRange: vi.fn(),
      subscribe: vi.fn((listener: () => void) => {
        listeners.add(listener);
        return () => listeners.delete(listener);
      }),
    } satisfies ITocService;
    const headingElement = document.createElement('h2');
    vi.spyOn(headingElement, 'getBoundingClientRect').mockReturnValue({
      bottom: 124,
      height: 24,
      left: 0,
      right: 320,
      toJSON: () => ({}),
      top: 100,
      width: 320,
      x: 0,
      y: 100,
    });
    const lexicalEditor = {
      getElementByKey: (key: string) => (key === 'heading-a' ? headingElement : null),
    };
    const editor = {
      getLexicalEditor: () => lexicalEditor,
      getRootElement: () => host,
      off: vi.fn(),
      on: vi.fn(),
      requireService: vi.fn(() => service),
    } as unknown as IEditor;
    const scrollContainer = document.createElement('section');
    const onItemsChange = vi.fn();
    let jumpTo: ((key: string) => void) | undefined;

    const HostOwnedToc = () => {
      const toc = useToc({
        behavior: 'auto',
        editor,
        getScrollContainer: () => scrollContainer,
        maxDepth: 4,
        minDepth: 2,
        offsetTop: 48,
        onItemsChange,
      });
      jumpTo = toc.jumpTo;

      return (
        <nav aria-label="Host table of contents">
          {toc.items.map((item) => (
            <button
              aria-current={toc.activeKey === item.key ? 'location' : undefined}
              key={item.key}
            >
              {item.title}
            </button>
          ))}
        </nav>
      );
    };

    await act(async () => {
      root.render(<HostOwnedToc />);
    });

    expect(service.setDepthRange).toHaveBeenCalledWith({ maxDepth: 4, minDepth: 2 });
    expect(host.textContent).toBe('Host rendered heading');
    expect(host.querySelector('button')?.getAttribute('aria-current')).toBe('location');
    expect(onItemsChange).toHaveBeenLastCalledWith(items);

    items = [
      {
        children: [],
        depth: 3,
        key: 'heading-b',
        tag: 'h3',
        title: 'Updated outside the editor',
      },
    ];
    activeKey = 'heading-b';
    await act(async () => {
      emitChange();
    });

    expect(host.textContent).toBe('Updated outside the editor');
    expect(host.querySelector('button')?.getAttribute('aria-current')).toBe('location');
    expect(onItemsChange).toHaveBeenLastCalledWith(items);

    act(() => {
      jumpTo?.('heading-b');
    });

    expect(service.jumpTo).toHaveBeenCalledWith('heading-b', {
      behavior: 'auto',
      container: scrollContainer,
      offsetTop: 48,
    });
  });
});
