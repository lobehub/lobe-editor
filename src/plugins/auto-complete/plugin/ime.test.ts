import {
  $createParagraphNode,
  $createTextNode,
  $getRoot,
  $getSelection,
  $isRangeSelection,
} from 'lexical';
import { afterEach, describe, expect, it, vi } from 'vitest';

import Editor from '@/editor-kernel';
import { CommonPlugin } from '@/plugins/common';
import { MarkdownPlugin } from '@/plugins/markdown/plugin';

import { AutoCompletePlugin } from './index';

vi.hoisted(() => {
  Object.defineProperty(navigator, 'platform', { configurable: true, value: 'MacIntel' });
  Object.defineProperty(navigator, 'userAgent', {
    configurable: true,
    value: 'Mozilla/5.0 (Macintosh) AppleWebKit/537.36 Chrome/140.0.0.0 Safari/537.36',
  });
  InputEvent.prototype.getTargetRanges = () => [];
  Range.prototype.getBoundingClientRect = () => new DOMRect();
});

const flush = async () => {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
};

afterEach(() => vi.useRealTimers());

describe('native composition replacement', () => {
  it.each([false, true])('replaces preedit a with 啊 (autocomplete %s)', async (enabled) => {
    vi.useFakeTimers();
    const kernel = Editor.createEditor().registerPlugins([CommonPlugin, MarkdownPlugin]);
    if (enabled)
      kernel.registerPlugin(AutoCompletePlugin, { delay: 10, onAutoComplete: async () => '建议' });
    const root = document.createElement('div');
    root.contentEditable = 'true';
    root.setAttribute('contenteditable', 'true');
    root.tabIndex = 0;
    document.body.append(root);
    const editor = kernel.setRootElement(root);
    const errors: unknown[] = [];
    kernel.on('error', (error) => errors.push(error));
    root.focus();
    editor.update(
      () => {
        const text = $createTextNode('前后');
        $getRoot().clear().append($createParagraphNode().append(text));
        text.select(1, 1);
      },
      { discrete: true },
    );
    await flush();
    await vi.advanceTimersByTimeAsync(10);
    await flush();

    const suffix = root.querySelector('[data-lexical-text]')!.textContent!.slice(1);
    const setDOMText = (value: string, offset: number) => {
      const dom = root.querySelector('[data-lexical-text]')!.firstChild!;
      dom.nodeValue = value;
      document.getSelection()!.setBaseAndExtent(dom, offset, dom, offset);
    };
    try {
      root.dispatchEvent(new CompositionEvent('compositionstart', { bubbles: true, data: '' }));
      await flush();
      root.dispatchEvent(
        new InputEvent('beforeinput', {
          bubbles: true,
          data: 'a',
          inputType: 'insertCompositionText',
          isComposing: true,
        }),
      );
      setDOMText('前a' + suffix, 2);
      root.dispatchEvent(
        new InputEvent('input', {
          bubbles: true,
          data: 'a',
          inputType: 'insertCompositionText',
          isComposing: true,
        }),
      );
      await flush();
      setDOMText('前啊' + suffix, 2);
      root.dispatchEvent(
        new InputEvent('input', {
          bubbles: true,
          data: '啊',
          inputType: 'insertCompositionText',
          isComposing: true,
        }),
      );
      root.dispatchEvent(new CompositionEvent('compositionend', { bubbles: true, data: '啊' }));
      await flush();
      await vi.advanceTimersByTimeAsync(0);
      editor.getEditorState().read(() => {
        expect($getRoot().getTextContent()).toBe('前啊后');
        const selection = $getSelection();
        expect($isRangeSelection(selection) && selection.isCollapsed()).toBe(true);
      });
      expect(errors).toEqual([]);
    } finally {
      kernel.destroy();
      root.remove();
    }
  });
});
