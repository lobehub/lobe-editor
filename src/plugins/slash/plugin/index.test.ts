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

  describe('@ mentions typed through an IME', () => {
    const item = { key: 'pm', label: 'PM' };

    const setup = () => {
      const triggerOpen = vi.fn();
      const editor = Editor.createEditor().registerPlugins([
        CommonPlugin,
        [
          SlashPlugin,
          {
            slashOptions: [{ items: [item], trigger: '@' }],
            triggerClose: vi.fn(),
            triggerOpen,
          },
        ],
      ]);
      const root = document.createElement('div');
      root.contentEditable = 'true';
      document.body.append(root);
      const lexicalEditor = editor.setRootElement(root);

      const setText = async (value: string) => {
        lexicalEditor.update(
          () => {
            const paragraph = $createParagraphNode();
            const text = $createTextNode(value);
            paragraph.append(text);
            $getRoot().clear().append(paragraph);
            text.selectEnd();
          },
          { discrete: true },
        );
        await flushEditorUpdates();
      };

      return { root, setText, triggerOpen };
    };

    it('reopens when an IME commits the trigger without a keydown', async () => {
      const { root, setText, triggerOpen } = setup();

      // Plain text closes the menu, which then waits for the next typing input.
      await setText('hi');
      // An IME (e.g. on macOS) commits `@` with no keydown Lexical forwards…
      await setText('hi @');
      expect(triggerOpen).not.toHaveBeenCalled();
      // …and ends the composition, which re-enables opening.
      root.dispatchEvent(new Event('compositionend', { bubbles: true }));
      await flushEditorUpdates();

      expect(triggerOpen).toHaveBeenLastCalledWith(
        expect.objectContaining({ lastIndex: 3, trigger: '@' }),
      );
    });

    it('reopens after a close on an IME "Process" keydown', async () => {
      const { root, setText, triggerOpen } = setup();

      await setText('hi');
      root.dispatchEvent(
        new KeyboardEvent('keydown', { bubbles: true, key: 'Process', keyCode: 229 }),
      );
      await setText('hi @');

      expect(triggerOpen).toHaveBeenCalled();
    });

    it('opens on a fullwidth ＠', async () => {
      const { setText, triggerOpen } = setup();

      await setText('＠');

      expect(triggerOpen).toHaveBeenLastCalledWith(
        expect.objectContaining({
          match: expect.objectContaining({ replaceableString: '＠' }),
          trigger: '@',
        }),
      );
    });
  });
});
