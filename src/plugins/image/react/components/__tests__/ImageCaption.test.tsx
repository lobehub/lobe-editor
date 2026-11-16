import { act } from 'react';
import { type Root, createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import ImageCaption from '../ImageCaption';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT =
  true;

const mocks = vi.hoisted(() => ({
  editable: true,
  editor: {
    update: vi.fn((callback: () => void) => callback()),
  },
}));

vi.mock('@/editor-kernel/react/useEditable', () => ({
  useEditable: () => ({ editable: mocks.editable }),
}));

vi.mock('@/editor-kernel/react/useLexicalEditor', async () => {
  const React = await vi.importActual<typeof import('react')>('react');

  return {
    useLexicalEditor: (handleEditor: (editor: typeof mocks.editor) => () => void) => {
      React.useEffect(() => handleEditor(mocks.editor), [handleEditor]);
    },
  };
});

vi.mock('@/editor-kernel/react/useTranslation', () => ({
  useTranslation: () => (key: string) => key,
}));

function setInputValue(input: HTMLInputElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!;
  setter.call(input, value);
  input.dispatchEvent(new Event('input', { bubbles: true }));
}

describe('ImageCaption', () => {
  let host: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    host = document.createElement('div');
    document.body.append(host);
    root = createRoot(host);
    mocks.editable = true;
    vi.clearAllMocks();
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    host.remove();
  });

  it('renders plain caption text in read-only mode', async () => {
    mocks.editable = false;
    const node = { caption: 'A sunset', setCaption: vi.fn() };

    await act(async () => {
      root.render(<ImageCaption active={false} node={node as any} />);
    });

    expect(host.querySelector('input')).toBeNull();
    expect(host.querySelector('[data-image-caption]')?.textContent).toBe('A sunset');
  });

  it('hides the empty caption field until the image is active', async () => {
    const node = { caption: '', setCaption: vi.fn() };

    await act(async () => {
      root.render(<ImageCaption active={false} node={node as any} />);
    });
    expect(host.querySelector('input')).toBeNull();

    await act(async () => {
      root.render(<ImageCaption active node={node as any} />);
    });
    expect(host.querySelector('input')?.placeholder).toBe('image.captionPlaceholder');
  });

  it('commits the edited caption on blur', async () => {
    const node = { caption: 'Old', setCaption: vi.fn() };

    await act(async () => {
      root.render(<ImageCaption active node={node as any} />);
    });

    const input = host.querySelector('input')!;
    await act(async () => {
      input.focus();
      setInputValue(input, 'New caption');
    });
    await act(async () => {
      input.blur();
    });

    expect(mocks.editor.update).toHaveBeenCalledTimes(1);
    expect(node.setCaption).toHaveBeenCalledWith('New caption');
  });

  it('discards the draft on Escape', async () => {
    const node = { caption: 'Old', setCaption: vi.fn() };

    await act(async () => {
      root.render(<ImageCaption active node={node as any} />);
    });

    const input = host.querySelector('input')!;
    await act(async () => {
      input.focus();
      setInputValue(input, 'Draft');
    });
    await act(async () => {
      input.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: 'Escape' }));
    });

    expect(node.setCaption).not.toHaveBeenCalled();
    expect(input.value).toBe('Old');
  });

  it('keeps keyboard events away from the editor root', async () => {
    const node = { caption: 'Old', setCaption: vi.fn() };
    const rootListener = vi.fn();
    document.body.addEventListener('keydown', rootListener);
    document.body.addEventListener('beforeinput', rootListener);

    await act(async () => {
      root.render(<ImageCaption active node={node as any} />);
    });

    const input = host.querySelector('input')!;
    input.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: 'Backspace' }));
    input.dispatchEvent(new InputEvent('beforeinput', { bubbles: true, inputType: 'insertText' }));

    document.body.removeEventListener('keydown', rootListener);
    document.body.removeEventListener('beforeinput', rootListener);
    expect(rootListener).not.toHaveBeenCalled();
  });
});
