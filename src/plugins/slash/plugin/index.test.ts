// @vitest-environment jsdom
import { $createParagraphNode, $createTextNode, $getRoot } from 'lexical';
import { describe, expect, it, vi } from 'vitest';

import Editor from '@/editor-kernel';
import { CommonPlugin } from '@/plugins/common';

import { SlashPlugin } from '.';

vi.mock('../utils/utils', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../utils/utils')>();

  return {
    ...actual,
    tryToPositionRange: () => true,
  };
});

const flushEditorUpdates = async () => {
  await Promise.resolve();
  await Promise.resolve();
};

describe('SlashPlugin', () => {
  it('keeps a max-length keyboard shortcut query open', async () => {
    const item = { key: 'insert-codeBlock', label: 'InsertCodeBlock' };
    const triggerOpen = vi.fn();
    const editor = Editor.createEditor().registerPlugins([
      CommonPlugin,
      [
        SlashPlugin,
        {
          slashOptions: [{ items: [item], maxLength: 16, trigger: '/' }],
          triggerClose: vi.fn(),
          triggerOpen,
        },
      ],
    ]);
    editor.initNodeEditor();

    const lexicalEditor = editor.getLexicalEditor();
    if (!lexicalEditor) {
      throw new Error('Lexical editor not initialized');
    }

    lexicalEditor.update(
      () => {
        const paragraph = $createParagraphNode();
        const text = $createTextNode('/insert-codeBlock');
        paragraph.append(text);
        $getRoot().clear().append(paragraph);
        text.selectEnd();
      },
      { discrete: true },
    );
    await flushEditorUpdates();

    expect(triggerOpen).toHaveBeenLastCalledWith(
      expect.objectContaining({
        items: [item],
        match: expect.objectContaining({ matchingString: 'insert-codeBlock' }),
        trigger: '/',
      }),
    );
  });
});
