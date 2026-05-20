import { act } from 'react';
import type { ReactNode } from 'react';
import { type Root, createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import Image from '../Image';
import type { ResizeHandleProps } from '../ResizeHandle';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT =
  true;

const mocks = vi.hoisted(() => {
  const editor = {
    registerCommand: vi.fn(() => vi.fn()),
    update: vi.fn((callback: () => void) => callback()),
  };

  return {
    editor,
    resizeHandleProps: [] as ResizeHandleProps[],
  };
});

vi.mock('@/editor-kernel/react/useLexicalEditor', async () => {
  const React = await vi.importActual<typeof import('react')>('react');

  return {
    useLexicalEditor: (handleEditor: (editor: typeof mocks.editor) => void) => {
      React.useEffect(() => {
        handleEditor(mocks.editor);
      }, [handleEditor]);
    },
  };
});

vi.mock('@/editor-kernel/react/useLexicalNodeSelection', () => ({
  useLexicalNodeSelection: () => [false, vi.fn(), vi.fn(), false],
}));

vi.mock('../ImageEditPopover', () => ({
  default: ({ children }: { children: ReactNode }) => children,
}));

vi.mock('../LazyImage', async () => {
  const React = await vi.importActual<typeof import('react')>('react');

  function MockLazyImage({
    newWidth,
    onLoad,
  }: {
    newWidth?: null | number;
    onLoad?: (dimensions: { height: number; width: number }) => void;
  }) {
    React.useEffect(() => {
      onLoad?.({ height: 100, width: 200 });
      // The image load event fires once for this regression path.
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    return React.createElement('img', {
      'data-testid': 'image',
      'style': { width: newWidth ?? 200 },
    });
  }

  return {
    default: MockLazyImage,
  };
});

vi.mock('../ResizeHandle', () => ({
  ResizeHandle: (props: ResizeHandleProps) => {
    mocks.resizeHandleProps.push(props);
    return null;
  },
}));

describe('Image resize', () => {
  let host: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    host = document.createElement('div');
    document.body.append(host);
    root = createRoot(host);
    mocks.resizeHandleProps.length = 0;
    vi.clearAllMocks();
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    host.remove();
  });

  it('persists the same width that is previewed during resizing', async () => {
    const node = {
      altText: 'test image',
      getKey: () => 'image-node',
      getType: () => 'block-image',
      maxWidth: 200,
      setMaxWidth: vi.fn(),
      setWidth: vi.fn(),
      src: 'https://example.com/image.png',
      status: 'uploaded',
      width: 200,
    };

    await act(async () => {
      root.render(<Image node={node as any} />);
    });

    const image = host.querySelector<HTMLImageElement>('[data-testid="image"]');
    expect(image).not.toBeNull();

    await act(async () => {
      image!.parentElement!.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
    });

    const rightHandle = mocks.resizeHandleProps.find((props) => props.position === 'right');
    expect(rightHandle).toBeDefined();

    await act(async () => {
      rightHandle!.onResizeStart(100);
      rightHandle!.onResize(20, 0, 'right');
    });

    expect(image!.parentElement!.style.width).toBe('140px');

    await act(async () => {
      rightHandle!.onResizeEnd?.(20, 0);
    });

    expect(node.setWidth).toHaveBeenCalledWith(140);
    expect(node.setMaxWidth).toHaveBeenCalledWith(140);
  });
});
