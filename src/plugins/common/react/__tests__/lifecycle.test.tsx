import { KEY_DOWN_COMMAND } from 'lexical';
import { act, Activity, StrictMode, useEffect, useRef } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import EditorKernel from '@/editor-kernel';
import { CommonPlugin } from '@/plugins/common';
import { IMarkdownShortCutService } from '@/plugins/markdown/service/shortcut';
import Editor from '@/react/Editor';
import { useEditor } from '@/react/hooks/useEditor';
import type { IEditor } from '@/types';

const hasExplicitGC = typeof (globalThis as typeof globalThis & { gc?: unknown }).gc === 'function';

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

  it('rebuilds the React editor runtime after an external destroy before reattach', () => {
    const externalEditor = EditorKernel.createEditor();
    let mode: 'hidden' | 'visible' = 'visible';
    const onPressEnter = vi.fn(() => true);

    const renderEditor = () =>
      root!.render(
        <Activity mode={mode}>
          <Editor
            content="initial"
            editor={externalEditor}
            onPressEnter={onPressEnter}
            type="text"
          />
        </Activity>,
      );

    act(renderEditor);

    const firstLexicalEditor = externalEditor.getLexicalEditor();
    expect(firstLexicalEditor).toBeDefined();
    expect(externalEditor.getDocument('text')).toBe('initial');
    expect(externalEditor.requireService(IMarkdownShortCutService)).not.toBeNull();

    externalEditor.destroy();
    expect(externalEditor.getLexicalEditor()).toBeNull();

    mode = 'hidden';
    act(renderEditor);
    mode = 'visible';
    act(renderEditor);

    const reinitializedLexicalEditor = externalEditor.getLexicalEditor();
    expect(reinitializedLexicalEditor).toBeDefined();
    expect(reinitializedLexicalEditor).not.toBe(firstLexicalEditor);
    expect(externalEditor.getRootElement()).toBeInstanceOf(HTMLElement);
    expect(externalEditor.getDocument('text')).toBe('initial');
    expect(externalEditor.requireService(IMarkdownShortCutService)).not.toBeNull();
    expect(externalEditor.isEditable()).toBe(true);

    expect(
      externalEditor.dispatchCommand(
        KEY_DOWN_COMMAND,
        new KeyboardEvent('keydown', { key: 'Enter' }),
      ),
    ).toBe(true);
    expect(onPressEnter).toHaveBeenCalledTimes(1);

    externalEditor.setDocument('text', 'restored');
    expect(externalEditor.getDocument('text')).toBe('restored');
    externalEditor.destroy();
  });

  it('keeps StrictMode Activity hide/show and duplicate cleanup listener-safe', () => {
    const addEventListener = vi.spyOn(window, 'addEventListener');
    const removeEventListener = vi.spyOn(window, 'removeEventListener');
    let editor: IEditor | undefined;
    let mode: 'hidden' | 'visible' = 'visible';
    let editable = true;

    const StrictModeEditor = () => {
      const nextEditor = useEditor();
      editor = nextEditor;
      return <Editor editor={nextEditor} content="initial" editable={editable} type="text" />;
    };

    const renderEditor = () =>
      root!.render(
        <StrictMode>
          <Activity mode={mode}>
            <StrictModeEditor />
          </Activity>
        </StrictMode>,
      );
    const messageAdds = () =>
      addEventListener.mock.calls.filter(([type]) => type === 'message').length;
    const messageRemoves = () =>
      removeEventListener.mock.calls.filter(([type]) => type === 'message').length;
    const activeDragonListeners = () => messageAdds() - messageRemoves();

    try {
      act(renderEditor);
      const initialLexicalEditor = editor?.getLexicalEditor();
      expect(initialLexicalEditor).toBeDefined();
      expect(activeDragonListeners()).toBe(1);

      for (let attempt = 0; attempt < 3; attempt += 1) {
        mode = 'hidden';
        act(renderEditor);
        expect(editor?.getRootElement()).toBeNull();
        expect(activeDragonListeners()).toBe(0);

        editable = attempt % 2 === 0;
        mode = 'visible';
        act(renderEditor);
        expect(editor?.getLexicalEditor()).toBe(initialLexicalEditor);
        expect(editor?.isEditable()).toBe(editable);
        expect(activeDragonListeners()).toBe(1);
      }

      mode = 'hidden';
      act(renderEditor);
      expect(() => act(() => root?.unmount())).not.toThrow();
      root = null;
      expect(activeDragonListeners()).toBe(0);
      expect(messageAdds()).toBe(messageRemoves());
    } finally {
      if (root) {
        act(() => root?.unmount());
        root = null;
      }
      addEventListener.mockRestore();
      removeEventListener.mockRestore();
    }
  });

  it('destroys a hook-owned editor when a permanent owner opts into autoDestroy', () => {
    let editor: IEditor | undefined;

    const PermanentEditor = () => {
      const nextEditor = useEditor({ autoDestroy: true });
      const containerRef = useRef<HTMLDivElement>(null);
      editor = nextEditor;

      useEffect(() => {
        nextEditor.registerPlugin(CommonPlugin);
        const container = containerRef.current;
        if (container) {
          nextEditor.setRootElement(container);
        }
      }, [nextEditor]);

      return <div ref={containerRef} />;
    };

    act(() => root!.render(<PermanentEditor />));
    expect(editor?.getLexicalEditor()).toBeDefined();

    act(() => root?.unmount());
    root = null;

    expect(editor?.getLexicalEditor()).toBeNull();
  });

  it.skipIf(!hasExplicitGC)(
    'allows a hook-owned editor to become collectible after unmount',
    async () => {
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
      expect(gc).toBeTypeOf('function');

      // Do not dereference the WeakRef in the loop condition: the temporary
      // strong reference would keep the editor alive through the next GC run.
      for (let attempt = 0; attempt < 10; attempt += 1) {
        gc!();
        await new Promise((resolve) => setTimeout(resolve, 10));
      }

      expect(editorRef?.deref()).toBeUndefined();
    },
  );
});
