import { Activity, act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { COMMAND_PRIORITY_CRITICAL, KEY_DOWN_COMMAND } from 'lexical';

import EditorKernel from '@/editor-kernel';
import { IMarkdownShortCutService } from '@/plugins/markdown/service/shortcut';
import Editor from '@/react/Editor';
import type { IEditor } from '@/types';

describe('React editor lifecycle', () => {
  let host: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    (
      globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
    ).IS_REACT_ACT_ENVIRONMENT = true;
    host = document.createElement('div');
    document.body.append(host);
    root = createRoot(host);
  });

  afterEach(() => {
    act(() => root.unmount());
    host.remove();
  });

  it('detaches an old root and rebuilds plugins after external destroy and Activity reattach', () => {
    const editor = EditorKernel.createEditor();
    let mode: 'hidden' | 'visible' = 'visible';
    const onPressEnter = vi.fn(() => true);

    const renderEditor = () =>
      root.render(
        <Activity mode={mode}>
          <Editor content="initial" editor={editor} onPressEnter={onPressEnter} type="text" />
        </Activity>,
      );

    act(renderEditor);
    const firstLexicalEditor = editor.getLexicalEditor();
    const firstRoot = editor.getRootElement();
    expect(firstLexicalEditor).toBeDefined();
    expect(firstRoot).toBeInstanceOf(HTMLElement);
    expect(editor.getDocument('text')).toBe('initial');
    expect(editor.requireService(IMarkdownShortCutService)).not.toBeNull();

    const oldRootCommand = vi.fn(() => false);
    firstLexicalEditor!.registerCommand(
      KEY_DOWN_COMMAND,
      oldRootCommand,
      COMMAND_PRIORITY_CRITICAL,
    );
    firstRoot!.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: 'F2' }));
    expect(oldRootCommand).toHaveBeenCalledTimes(1);

    editor.destroy();
    firstRoot!.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: 'F2' }));
    expect(oldRootCommand).toHaveBeenCalledTimes(1);
    expect(editor.getLexicalEditor()).toBeNull();

    mode = 'hidden';
    act(renderEditor);
    mode = 'visible';
    act(renderEditor);

    const reinitializedLexicalEditor = editor.getLexicalEditor();
    expect(reinitializedLexicalEditor).toBeDefined();
    expect(reinitializedLexicalEditor).not.toBe(firstLexicalEditor);
    expect(editor.getRootElement()).toBeInstanceOf(HTMLElement);
    expect(editor.getDocument('text')).toBe('initial');
    expect(editor.requireService(IMarkdownShortCutService)).not.toBeNull();
    expect(editor.isEditable()).toBe(true);

    expect(
      editor.dispatchCommand(KEY_DOWN_COMMAND, new KeyboardEvent('keydown', { key: 'Enter' })),
    ).toBe(true);
    expect(onPressEnter).toHaveBeenCalledTimes(1);

    editor.destroy();
  });
});
