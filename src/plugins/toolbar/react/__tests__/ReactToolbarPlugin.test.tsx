import { act } from 'react';
import type { DependencyList, ReactNode } from 'react';
import { type Root, createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { $getSelection, getDOMSelection } from 'lexical';

import { ReactToolbarPlugin } from '../';

const toolbarSelectionMock = vi.hoisted(() => ({ suppress: false }));
const positionMock = vi.hoisted(() =>
  vi.fn((_rect: unknown, element: HTMLElement) => {
    element.style.opacity = '1';
    element.style.transform = 'translate(0px, 0px)';
  }),
);

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT =
  true;

const mocks = vi.hoisted(() => {
  const unregister = vi.fn();
  const editorStateRead = vi.fn((callback: () => void) => callback());
  const lexicalEditor = {
    _window: undefined as undefined | Window,
    dispatchCommand: vi.fn(),
    getEditorState: vi.fn(() => ({
      read: editorStateRead,
    })),
    getRootElement: vi.fn(() => document.createElement('div')),
    registerCommand: vi.fn(() => unregister),
    registerRootListener: vi.fn((listener: () => void) => {
      listener();
      return unregister;
    }),
    registerUpdateListener: vi.fn(
      (_listener: (payload: { editorState: { read: (callback: () => void) => void } }) => void) =>
        unregister,
    ),
    update: vi.fn((callback: () => void) => callback()),
  };
  const kernelEditor = {
    requireService: vi.fn(() => null),
  };

  return {
    editorStateRead,
    kernelEditor,
    lexicalEditor,
    unregister,
  };
});

vi.mock('lexical', async () => {
  const actual = await vi.importActual<typeof import('lexical')>('lexical');

  return {
    ...actual,
    $getSelection: vi.fn(() => null),
    getDOMSelection: vi.fn(() => null),
  };
});

vi.mock('@lobehub/ui', async () => {
  const React = await vi.importActual<typeof import('react')>('react');

  return {
    Block: React.forwardRef<HTMLDivElement, { children?: ReactNode }>(
      ({ children, ...props }, ref) => (
        <div ref={ref} {...props}>
          {children}
        </div>
      ),
    ),
    LOBE_THEME_APP_ID: 'lobe-theme-app',
  };
});

vi.mock('antd-style', () => ({
  cx: (...classNames: Array<string | undefined>) => classNames.filter(Boolean).join(' '),
  useThemeMode: () => ({ isDarkMode: false }),
}));

vi.mock('@/editor-kernel/react', async () => {
  const React = await vi.importActual<typeof import('react')>('react');

  return {
    useLexicalComposerContext: () => [mocks.kernelEditor],
    useLexicalEditor: (
      handleEditor: (editor: typeof mocks.lexicalEditor) => (() => void) | undefined,
      deps: DependencyList = [],
    ) => {
      React.useEffect(() => handleEditor(mocks.lexicalEditor), deps);
    },
  };
});

vi.mock('@/plugins/link', () => ({
  ILinkService: Symbol('ILinkService'),
}));

vi.mock('../selection', () => ({
  $shouldSuppressTextToolbar: () => toolbarSelectionMock.suppress,
}));

vi.mock('../../utils/getDOMRangeRect', () => ({
  getDOMRangeRect: () => new DOMRect(10, 10, 80, 20),
}));

vi.mock('../../utils/setFloatingElemPosition', () => ({
  setFloatingElemPosition: positionMock,
}));

vi.mock('../style', () => ({
  styles: {
    anchor: 'toolbar-anchor',
    portalAnchor: 'toolbar-portal-anchor',
    toolbarDark: 'toolbar-dark',
    toolbarLight: 'toolbar-light',
  },
}));

describe('ReactToolbarPlugin portal rendering', () => {
  let host: HTMLDivElement;
  let themeApp: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    host = document.createElement('div');
    themeApp = document.createElement('div');
    themeApp.id = 'lobe-theme-app';
    document.body.append(themeApp, host);
    root = createRoot(host);
    mocks.lexicalEditor._window = window;
    toolbarSelectionMock.suppress = false;
    positionMock.mockClear();
    vi.clearAllMocks();
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    host.remove();
    themeApp.remove();
  });

  it('renders the toolbar into the theme app container by default', async () => {
    await act(async () => {
      root.render(
        <ReactToolbarPlugin>
          <button data-testid="toolbar-action" type="button" />
        </ReactToolbarPlugin>,
      );
    });

    expect(themeApp.querySelector('[data-testid="toolbar-action"]')).not.toBeNull();
    expect(host.querySelector('[data-testid="toolbar-action"]')).toBeNull();
  });

  it('renders the toolbar into a custom popup container', async () => {
    const customContainer = document.createElement('div');
    document.body.append(customContainer);

    await act(async () => {
      root.render(
        <ReactToolbarPlugin getPopupContainer={() => customContainer}>
          <button data-testid="toolbar-action" type="button" />
        </ReactToolbarPlugin>,
      );
    });

    expect(customContainer.querySelector('[data-testid="toolbar-action"]')).not.toBeNull();
    expect(themeApp.querySelector('[data-testid="toolbar-action"]')).toBeNull();

    customContainer.remove();
  });

  it('renders locally when portal rendering is disabled', async () => {
    await act(async () => {
      root.render(
        <ReactToolbarPlugin usePortal={false}>
          <button data-testid="toolbar-action" type="button" />
        </ReactToolbarPlugin>,
      );
    });

    expect(host.querySelector('[data-testid="toolbar-action"]')).not.toBeNull();
    expect(themeApp.querySelector('[data-testid="toolbar-action"]')).toBeNull();
  });

  it('recomputes the toolbar position after scrolling', async () => {
    const requestAnimationFrameSpy = vi
      .spyOn(window, 'requestAnimationFrame')
      .mockImplementation((callback) => {
        callback(0);
        return 1;
      });
    const cancelAnimationFrameSpy = vi
      .spyOn(window, 'cancelAnimationFrame')
      .mockImplementation(() => {});

    await act(async () => {
      root.render(
        <ReactToolbarPlugin>
          <button data-testid="toolbar-action" type="button" />
        </ReactToolbarPlugin>,
      );
    });

    mocks.editorStateRead.mockClear();

    await act(async () => {
      window.dispatchEvent(new Event('scroll'));
    });

    expect(mocks.editorStateRead).toHaveBeenCalledTimes(1);

    requestAnimationFrameSpy.mockRestore();
    cancelAnimationFrameSpy.mockRestore();
  });

  it('hides atomic selections before DOM range positioning and restores ordinary text ranges', async () => {
    const editorRoot = document.createElement('div');
    const text = document.createTextNode('ordinary text');
    editorRoot.append(text);
    document.body.append(editorRoot);
    mocks.lexicalEditor.getRootElement.mockReturnValue(editorRoot);
    vi.mocked($getSelection).mockReturnValue({} as never);
    vi.mocked(getDOMSelection).mockReturnValue({
      anchorNode: text,
      isCollapsed: false,
    } as unknown as Selection);

    await act(async () => {
      root.render(
        <ReactToolbarPlugin>
          <button data-testid="toolbar-action" type="button" />
        </ReactToolbarPlugin>,
      );
    });

    const updateListener = mocks.lexicalEditor.registerUpdateListener.mock.calls.at(-1)?.[0];
    const toolbar = themeApp.querySelector<HTMLElement>('.toolbar-light');
    if (!updateListener || !toolbar) throw new Error('Toolbar listener missing');

    toolbarSelectionMock.suppress = true;
    await act(async () => {
      updateListener({ editorState: { read: (callback: () => void) => callback() } });
    });
    expect(toolbar.style.opacity).toBe('0');
    expect(toolbar.style.transform).toBe('translate(-10000px, -10000px)');
    expect(positionMock).not.toHaveBeenCalled();

    toolbarSelectionMock.suppress = false;
    await act(async () => {
      updateListener({ editorState: { read: (callback: () => void) => callback() } });
    });
    expect(positionMock).toHaveBeenCalledOnce();
    expect(toolbar.style.opacity).toBe('1');

    editorRoot.remove();
  });
});
