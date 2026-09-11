import { SELECTION_CHANGE_COMMAND } from 'lexical';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import Editor from '@/editor-kernel';
import { CommonPlugin } from '@/plugins/common';

import { useEditorState } from '..';

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

describe('useEditorState teardown', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('drops a pending toolbar update when the host unmounts', () => {
    const kernel = Editor.createEditor().registerPlugins([CommonPlugin]);
    const editorRoot = document.createElement('div');
    document.body.append(editorRoot);
    kernel.setRootElement(editorRoot);

    const container = document.createElement('div');
    document.body.append(container);
    const reactRoot = createRoot(container);
    const Host = () => {
      useEditorState(kernel);
      return null;
    };

    act(() => {
      reactRoot.render(<Host />);
    });

    act(() => {
      kernel.getLexicalEditor()!.dispatchCommand(SELECTION_CHANGE_COMMAND, undefined);
    });

    act(() => {
      reactRoot.unmount();
    });
    kernel.destroy();

    const readAfterTeardown = vi.spyOn(kernel, 'getLexicalEditor');
    expect(() => vi.advanceTimersByTime(2000)).not.toThrow();
    expect(readAfterTeardown).not.toHaveBeenCalled();
  });
});
