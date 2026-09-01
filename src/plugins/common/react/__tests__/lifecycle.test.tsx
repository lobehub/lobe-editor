import { act, Activity, useEffect, useRef } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { CommonPlugin } from '@/plugins/common';
import Editor from '@/react/Editor';
import { useEditor } from '@/react/hooks/useEditor';
import type { IEditor } from '@/types';

describe('React editor root lifecycle', () => {
  let host: HTMLDivElement | null;
  let root: Root | null;

  beforeEach(() => {
    (
      globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
    ).IS_REACT_ACT_ENVIRONMENT = true;
    host = document.createElement('div');
    document.body.append(host);
    root = createRoot(host);
  });

  afterEach(() => {
    if (root) {
      act(() => root?.unmount());
    }
    host?.remove();
    root = null;
    host = null;
  });

  it('detaches and reattaches one editor through Activity without resetting input state', () => {
    let editor: IEditor | undefined;
    let mode: 'hidden' | 'visible' = 'visible';

    const renderEditor = () =>
      root!.render(
        <Activity mode={mode}>
          <Editor
            content="initial"
            onInit={(nextEditor) => {
              editor = nextEditor;
            }}
            type="text"
          />
        </Activity>,
      );

    act(renderEditor);

    expect(editor).toBeDefined();
    const initialEditor = editor!;
    const initialLexicalEditor = initialEditor.getLexicalEditor();
    const initialRoot = initialEditor.getRootElement();
    expect(initialLexicalEditor).toBeDefined();
    expect(initialRoot).toBeInstanceOf(HTMLElement);

    act(() => {
      initialEditor.setDocument('text', 'before hide');
    });
    const beforeHideState = initialLexicalEditor!.getEditorState();

    mode = 'hidden';
    act(renderEditor);

    expect(initialEditor.getLexicalEditor()).toBe(initialLexicalEditor);
    expect(initialEditor.getRootElement()).toBeNull();
    expect(initialLexicalEditor!.getEditorState()).toBe(beforeHideState);

    mode = 'visible';
    act(renderEditor);

    expect(editor).toBe(initialEditor);
    expect(initialEditor.getLexicalEditor()).toBe(initialLexicalEditor);
    expect(initialEditor.getRootElement()).toBe(initialRoot);

    act(() => {
      initialEditor.setDocument('text', 'after show');
    });
    expect(initialEditor.getDocument('text')).toBe('after show');
  });

  it('allows a hook-owned editor to become collectible after unmount', async () => {
    let editorRef: WeakRef<IEditor> | undefined;
    let mode: 'hidden' | 'visible' = 'visible';

    const HookOwnedEditor = () => {
      const editor = useEditor();
      const containerRef = useRef<HTMLDivElement>(null);

      useEffect(() => {
        editorRef = new WeakRef(editor);
        editor.registerPlugin(CommonPlugin);
        const container = containerRef.current;
        if (container) {
          editor.setRootElement(container);
        }
      }, [editor]);

      return <div ref={containerRef} />;
    };

    const renderHookOwnedEditor = () =>
      root!.render(
        <Activity mode={mode}>
          <HookOwnedEditor />
        </Activity>,
      );

    act(renderHookOwnedEditor);
    expect(editorRef?.deref()).toBeDefined();

    mode = 'hidden';
    act(renderHookOwnedEditor);
    expect(editorRef?.deref()?.getRootElement()).toBeNull();

    act(() => root?.unmount());
    root = null;
    host?.remove();
    host = null;

    const gc = (globalThis as typeof globalThis & { gc?: () => void }).gc;
    if (!gc) {
      return;
    }

    // Do not dereference the WeakRef in the loop condition: the temporary
    // strong reference would keep the editor alive through the next GC run.
    for (let attempt = 0; attempt < 10; attempt += 1) {
      gc();
      await new Promise((resolve) => setTimeout(resolve, 10));
    }

    expect(editorRef?.deref()).toBeUndefined();
  });
});
