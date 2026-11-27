import { $getRoot, $getSelection, $isRangeSelection, KEY_ESCAPE_COMMAND } from 'lexical';
import { expect, it } from 'vitest';

import { Kernel } from '@/editor-kernel/kernel';
import { CommonPlugin } from '@/plugins/common';
import { MarkdownPlugin } from '@/plugins/markdown';

import { AutoCompletePlugin } from '../plugin';

it.each([true, false])(
  'keeps focus and the committed caret during composition (Markdown: %s)',
  (markdownEnabled) => {
    const kernel = new Kernel();
    kernel.registerPlugins(
      markdownEnabled
        ? [CommonPlugin, MarkdownPlugin, AutoCompletePlugin]
        : [CommonPlugin, AutoCompletePlugin],
    );
    const rangeBounds = Object.getOwnPropertyDescriptor(Range.prototype, 'getBoundingClientRect');
    Range.prototype.getBoundingClientRect ??= () => new DOMRect();
    const root = document.createElement('div');
    root.contentEditable = 'true';
    root.tabIndex = 0;
    document.body.append(root);

    try {
      const editor = kernel.setRootElement(root);
      kernel.setDocument('text', '中文');
      root.focus();
      editor.update(() => $getRoot().selectEnd(), { discrete: true });

      // The chat input sends a synthetic Escape to clear any suggestion.
      root.addEventListener('compositionstart', () => {
        editor.dispatchCommand(KEY_ESCAPE_COMMAND, new KeyboardEvent('keydown', { key: 'Escape' }));
      });
      root.dispatchEvent(new CompositionEvent('compositionstart', { bubbles: true }));
      expect(editor.isComposing()).toBe(true);
      expect(document.activeElement).toBe(root);

      const text = root.querySelector('[data-lexical-text]')!.firstChild!;
      text.nodeValue = '中文：';
      document.getSelection()!.collapse(text, 3);
      root.dispatchEvent(new CompositionEvent('compositionend', { bubbles: true, data: '：' }));

      editor.getEditorState().read(() => {
        expect($getRoot().getTextContent()).toBe('中文：');
        const selection = $getSelection();
        expect(
          $isRangeSelection(selection) && selection.isCollapsed() && selection.anchor.offset,
        ).toBe(3);
      });
    } finally {
      kernel.destroy();
      root.remove();
      if (!rangeBounds) Reflect.deleteProperty(Range.prototype, 'getBoundingClientRect');
    }
  },
);
