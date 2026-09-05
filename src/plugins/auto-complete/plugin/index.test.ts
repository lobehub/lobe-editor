import {
  $createParagraphNode,
  $createTextNode,
  $getRoot,
  $getSelection,
  $isRangeSelection,
  $isElementNode,
  $isTextNode,
  KEY_ESCAPE_COMMAND,
  KEY_TAB_COMMAND,
  UNDO_COMMAND,
} from 'lexical';
import type { LexicalEditor } from 'lexical';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import Editor from '@/editor-kernel';
import { CommonPlugin } from '@/plugins/common';
import { MarkdownPlugin } from '@/plugins/markdown/plugin';

import { AutoCompletePlugin } from './index';

const fixtures: Array<{
  kernel: ReturnType<typeof Editor.createEditor>;
  root: HTMLElement;
  errors: unknown[];
}> = [];
const flush = async () => {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
};
beforeAll(() => {
  Range.prototype.getBoundingClientRect = () => new DOMRect();
});
afterEach(() => {
  for (const fixture of fixtures.splice(0)) {
    fixture.kernel.destroy();
    fixture.root.remove();
    expect(fixture.errors).toEqual([]);
  }
  vi.useRealTimers();
});

function setup(onAutoComplete = vi.fn(async () => '建议')) {
  vi.useFakeTimers();
  const kernel = Editor.createEditor().registerPlugins([CommonPlugin, MarkdownPlugin]);
  const accepted = vi.fn();
  const rejected = vi.fn();
  kernel.registerPlugin(AutoCompletePlugin, {
    delay: 25,
    onAutoComplete,
    onSuggestionAccepted: accepted,
    onSuggestionRejected: rejected,
  });
  const root = document.createElement('div');
  root.setAttribute('contenteditable', 'true');
  root.tabIndex = 0;
  document.body.append(root);
  const errors: unknown[] = [];
  kernel.on('error', (error) => errors.push(error));
  const editor = kernel.setRootElement(root);
  fixtures.push({ kernel, root, errors });
  root.focus();
  editor.update(
    () => {
      const text = $createTextNode('abcdef');
      $getRoot().clear().append($createParagraphNode().append(text));
      text.select(3, 3);
    },
    { discrete: true },
  );
  return { kernel, editor, root, accepted, rejected, onAutoComplete };
}

const text = (editor: LexicalEditor) =>
  editor.getEditorState().read(() => $getRoot().getTextContent());
const preview = (root: HTMLElement) =>
  root.querySelector<HTMLElement>('[data-auto-complete-preview]');
const show = async () => {
  await vi.advanceTimersByTimeAsync(25);
  await flush();
};

function nativeInput(root: HTMLElement, value: string, offset: number, data: string) {
  const selection = document.getSelection()!;
  const dom = selection.anchorNode!;
  expect(dom.nodeType).toBe(Node.TEXT_NODE);
  root.dispatchEvent(
    new InputEvent('beforeinput', {
      bubbles: true,
      inputType: 'insertCompositionText',
      data,
      isComposing: true,
    }),
  );
  dom.nodeValue = value;
  selection.setBaseAndExtent(dom, offset, dom, offset);
  root.dispatchEvent(
    new InputEvent('input', {
      bubbles: true,
      inputType: 'insertCompositionText',
      data,
      isComposing: true,
    }),
  );
}

describe('AutoCompletePlugin', () => {
  it('shows a multiline preview without splitting the original paragraph, then cancels it cleanly', async () => {
    const f = setup(vi.fn(async () => '建议\n\n第二段'));
    await show();
    const node = preview(f.root)!;
    expect(node).not.toBeNull();
    expect(node.contentEditable).toBe('false');
    expect(node.textContent).toBe('建议第二段');
    expect(node.querySelector('p')).not.toBeNull();
    expect(f.editor.getEditorState().read(() => $getRoot().getChildrenSize())).toBe(1);
    const event = new KeyboardEvent('keydown', { key: 'Escape', cancelable: true });
    f.editor.dispatchCommand(KEY_ESCAPE_COMMAND, event);
    await flush();
    expect(event.defaultPrevented).toBe(true);
    expect(preview(f.root)).toBeNull();
    expect(text(f.editor)).toBe('abcdef');
    expect(f.editor.getEditorState().read(() => $getRoot().getChildrenSize())).toBe(1);
    expect(f.rejected).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ reason: 'esc' }));
    await show();
    expect(f.onAutoComplete).toHaveBeenCalledTimes(1);
  });

  it('hides preview synchronously, preserves preedit replacement, and resumes after composition', async () => {
    const f = setup();
    await show();
    const node = preview(f.root)!;
    f.root.dispatchEvent(new CompositionEvent('compositionstart', { bubbles: true }));
    expect(node.style.display).toBe('none');
    expect(node.isConnected).toBe(true);
    await flush();
    nativeInput(f.root, 'abca', 4, 'a');
    await flush();
    expect(node.isConnected).toBe(true);
    nativeInput(f.root, 'abc啊', 4, '啊');
    f.root.dispatchEvent(new CompositionEvent('compositionend', { bubbles: true, data: '啊' }));
    await flush();
    expect(node.style.display).toBe('none');
    await vi.advanceTimersByTimeAsync(0);
    expect(preview(f.root)).toBeNull();
    expect(text(f.editor)).toBe('abc啊def');
    expect(f.rejected).toHaveBeenCalledTimes(1);
    await show();
    expect(f.onAutoComplete).toHaveBeenCalledTimes(2);
    expect(preview(f.root)!.style.display).toBe('');
  });

  it('lets the IME own Tab and Escape, including a cancelled composition', async () => {
    const f = setup();
    await show();
    f.root.dispatchEvent(new CompositionEvent('compositionstart', { bubbles: true }));
    const tab = new KeyboardEvent('keydown', { key: 'Tab', isComposing: true, cancelable: true });
    const esc = new KeyboardEvent('keydown', {
      key: 'Escape',
      isComposing: true,
      cancelable: true,
    });
    f.editor.dispatchCommand(KEY_TAB_COMMAND, tab);
    f.editor.dispatchCommand(KEY_ESCAPE_COMMAND, esc);
    expect(tab.defaultPrevented).toBe(false);
    expect(esc.defaultPrevented).toBe(false);
    expect(f.accepted).not.toHaveBeenCalled();
    f.root.dispatchEvent(new CompositionEvent('compositionend', { bubbles: true, data: '' }));
    await vi.advanceTimersByTimeAsync(0);
    expect(text(f.editor)).toBe('abcdef');
  });

  it('accepts once and undo removes only the accepted suggestion', async () => {
    const f = setup();
    await show();
    f.editor.dispatchCommand(
      KEY_TAB_COMMAND,
      new KeyboardEvent('keydown', { key: 'Tab', cancelable: true }),
    );
    await flush();
    expect(text(f.editor)).toBe('abc建议def');
    expect(preview(f.root)).toBeNull();
    expect(f.accepted).toHaveBeenCalledTimes(1);
    expect(f.rejected).not.toHaveBeenCalled();
    f.editor.dispatchCommand(UNDO_COMMAND, undefined);
    await flush();
    expect(text(f.editor)).toBe('abcdef');
    expect(preview(f.root)).toBeNull();
  });

  it('discards a late response after the paragraph changes at the same caret position', async () => {
    let resolve!: (value: string) => void;
    const f = setup(
      vi.fn(
        () =>
          new Promise<string>((done) => {
            resolve = done;
          }),
      ),
    );
    await show();
    f.editor.update(() => {
      const selection = $getSelection();
      if (!$isRangeSelection(selection)) throw new Error('missing selection');
      const paragraph = $getRoot().getFirstChildOrThrow();
      if (!$isElementNode(paragraph)) throw new Error('missing paragraph');
      const node = paragraph.getFirstChildOrThrow();
      if (!$isTextNode(node)) throw new Error('missing text');
      node.setTextContent('xyzdef');
    });
    await flush();
    resolve('过期');
    await flush();
    expect(preview(f.root)).toBeNull();
    expect(text(f.editor)).toBe('xyzdef');
  });

  it('aborts a pending request on blur', async () => {
    let resolve!: (value: string) => void;
    const f = setup(
      vi.fn(
        () =>
          new Promise<string>((done) => {
            resolve = done;
          }),
      ),
    );
    await show();
    f.root.blur();
    resolve('过期');
    await flush();
    expect(preview(f.root)).toBeNull();
    expect(text(f.editor)).toBe('abcdef');
  });

  it('does not restart requests when composition ends outside the editor', async () => {
    const f = setup();
    f.root.dispatchEvent(new CompositionEvent('compositionstart', { bubbles: true }));
    f.root.blur();
    f.root.dispatchEvent(new CompositionEvent('compositionend', { bubbles: true, data: '' }));
    await vi.advanceTimersByTimeAsync(100);
    expect(f.onAutoComplete).not.toHaveBeenCalled();
  });

  it('cleans up a hidden preview on detach and cancels deferred work on destroy', async () => {
    const f = setup();
    await show();
    f.root.dispatchEvent(new CompositionEvent('compositionstart', { bubbles: true }));
    f.editor.setRootElement(null);
    await flush();
    // Read the serialized model while detached: Lexical refreshes the root's
    // cached text on reconciliation when the DOM is attached again.
    expect(f.editor.getEditorState().toJSON().root.children).toEqual([
      expect.objectContaining({ children: [expect.objectContaining({ text: 'abcdef' })] }),
    ]);
    f.editor.setRootElement(f.root);
    expect(text(f.editor)).toBe('abcdef');
    f.root.focus();
    await show();
    expect(preview(f.root)!.style.display).toBe('');
    f.root.dispatchEvent(new CompositionEvent('compositionstart', { bubbles: true }));
    f.root.dispatchEvent(new CompositionEvent('compositionend', { bubbles: true, data: '' }));
    f.kernel.destroy();
    await vi.advanceTimersByTimeAsync(100);
    expect(preview(f.root)).toBeNull();
  });
});
