import { $createParagraphNode, $createTextNode, $getRoot } from 'lexical';
import { expect, it, vi } from 'vitest';

import Editor from '@/editor-kernel';
import { CommonPlugin } from '@/plugins/common';
import { MarkdownPlugin } from '@/plugins/markdown/plugin';

import { AutoCompletePlugin } from './index';

// Lexical selects its native composition path at module initialization.
vi.hoisted(() => {
  Object.defineProperty(navigator, 'platform', { configurable: true, value: 'MacIntel' });
  Object.defineProperty(navigator, 'userAgent', {
    configurable: true,
    value: 'Mozilla/5.0 (Macintosh) AppleWebKit/605.1.15 Version/17.6 Safari/605.1.15',
  });
  InputEvent.prototype.getTargetRanges = () => [];
  Range.prototype.getBoundingClientRect = () => new DOMRect();
});

it('waits for Safari insertFromComposition even if the settlement timer fires first', async () => {
  vi.useFakeTimers();
  const kernel = Editor.createEditor().registerPlugins([CommonPlugin, MarkdownPlugin]);
  const request = vi.fn(async () => '建议');
  kernel.registerPlugin(AutoCompletePlugin, { delay: 10, onAutoComplete: request });
  const errors: unknown[] = [];
  kernel.on('error', (error) => errors.push(error));
  const root = document.createElement('div');
  root.setAttribute('contenteditable', 'true');
  root.tabIndex = 0;
  document.body.append(root);
  const editor = kernel.setRootElement(root);
  root.focus();
  try {
    editor.update(
      () => {
        const text = $createTextNode('前后');
        $getRoot().clear().append($createParagraphNode().append(text));
        text.select(1, 1);
      },
      { discrete: true },
    );
    await vi.advanceTimersByTimeAsync(10);
    const preview = root.querySelector<HTMLElement>('[data-auto-complete-preview]')!;
    expect(preview).not.toBeNull();
    root.dispatchEvent(new CompositionEvent('compositionstart', { bubbles: true }));
    expect(preview.style.display).toBe('none');
    const dom = root.querySelector('[data-lexical-text]')!.firstChild!;
    dom.nodeValue = '前a';
    document.getSelection()!.setBaseAndExtent(dom, 2, dom, 2);
    root.dispatchEvent(
      new InputEvent('input', {
        bubbles: true,
        data: 'a',
        inputType: 'insertCompositionText',
        isComposing: true,
      }),
    );
    await Promise.resolve();
    // Safari's composing DOM may include Lexical's non-breaking-space marker.
    const preeditDOM = dom.nodeValue;
    expect(preeditDOM).toContain('前a');
    root.dispatchEvent(new CompositionEvent('compositionend', { bubbles: true, data: '啊' }));

    // The timer is allowed to run, but Lexical still owns the native preedit
    // range. Neither the preview nor its neighboring text may be removed.
    await vi.advanceTimersByTimeAsync(50);
    expect(editor.isComposing()).toBe(true);
    expect(preview.isConnected).toBe(true);
    expect(dom.nodeValue).toBe(preeditDOM);
    expect(request).toHaveBeenCalledTimes(1);

    const range = document.createRange();
    range.setStart(dom, 1);
    range.setEnd(dom, 2);
    const commit = new InputEvent('beforeinput', {
      bubbles: true,
      cancelable: true,
      data: '啊',
      inputType: 'insertFromComposition',
    });
    commit.getTargetRanges = () => [range];
    root.dispatchEvent(commit);
    // Lexical handles this beforeinput itself and prevents native insertion.
    expect(commit.defaultPrevented).toBe(true);
    expect(editor.isComposing()).toBe(false);
    await vi.advanceTimersByTimeAsync(0);
    expect(preview.isConnected).toBe(false);
    expect(editor.getEditorState().read(() => $getRoot().getTextContent())).toBe('前啊后');
    await vi.advanceTimersByTimeAsync(10);
    expect(request).toHaveBeenCalledTimes(2);
    expect(root.querySelector<HTMLElement>('[data-auto-complete-preview]')!.style.display).toBe('');
    expect(errors).toEqual([]);
  } finally {
    kernel.destroy();
    root.remove();
    vi.useRealTimers();
  }
});
