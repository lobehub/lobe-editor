import { $getRoot, KEY_TAB_COMMAND } from 'lexical';
import { afterEach, describe, expect, it, vi } from 'vitest';

import Editor from '@/editor-kernel';
import { CommonPlugin } from '@/plugins/common';
import { LitexmlPlugin } from '@/plugins/litexml';
import { MarkdownPlugin } from '@/plugins/markdown/plugin';
import type { IEditor } from '@/types';

import { AutoCompletePlugin } from '..';

const waitForPlaceholder = async (kernel: IEditor) => {
  await vi.waitFor(() => {
    const json = kernel.getDocument('json') as any;
    expect(JSON.stringify(json)).toContain('PlaceholderInline');
  });
};

describe('AutoCompletePlugin', () => {
  let kernel: IEditor | undefined;

  afterEach(() => {
    kernel?.destroy();
    kernel = undefined;
  });

  it('does not expose an unaccepted suggestion as document content', async () => {
    kernel = Editor.createEditor();
    kernel.registerPlugins([LitexmlPlugin, MarkdownPlugin, CommonPlugin]);
    kernel.registerPlugin(AutoCompletePlugin, {
      delay: 1,
      onAutoComplete: async () => 'ghost',
    });

    const lexicalEditor = kernel.setRootElement(document.createElement('div'));
    kernel.setDocument('text', 'abc');
    lexicalEditor.update(() => $getRoot().selectEnd(), { discrete: true });

    await waitForPlaceholder(kernel);

    expect(kernel.getDocument('markdown')).toBe('abc\n');
    expect(kernel.getDocument('litexml')).not.toContain('ghost');
  });

  it('clears an unaccepted suggestion when IME composition starts', async () => {
    kernel = Editor.createEditor();
    kernel.registerPlugins([LitexmlPlugin, MarkdownPlugin, CommonPlugin]);
    kernel.registerPlugin(AutoCompletePlugin, {
      delay: 1,
      onAutoComplete: async () => 'ghost',
    });

    const rootElement = document.createElement('div');
    const lexicalEditor = kernel.setRootElement(rootElement);
    kernel.setDocument('text', 'abc');
    lexicalEditor.update(() => $getRoot().selectEnd(), { discrete: true });

    await waitForPlaceholder(kernel);

    rootElement.dispatchEvent(new Event('compositionstart', { bubbles: true }));

    expect(JSON.stringify(kernel.getDocument('json'))).not.toContain('PlaceholderInline');
  });

  it('exposes the suggestion as document content after accepting it', async () => {
    kernel = Editor.createEditor();
    kernel.registerPlugins([LitexmlPlugin, MarkdownPlugin, CommonPlugin]);
    kernel.registerPlugin(AutoCompletePlugin, {
      delay: 1,
      onAutoComplete: async () => 'ghost',
    });

    const lexicalEditor = kernel.setRootElement(document.createElement('div'));
    kernel.setDocument('text', 'abc');
    lexicalEditor.update(() => $getRoot().selectEnd(), { discrete: true });

    await waitForPlaceholder(kernel);

    lexicalEditor.dispatchCommand(KEY_TAB_COMMAND, new KeyboardEvent('keydown', { key: 'Tab' }));

    expect(JSON.stringify(kernel.getDocument('json'))).not.toContain('PlaceholderInline');
    expect(kernel.getDocument('markdown')).toBe('abcghost\n');
  });
});
