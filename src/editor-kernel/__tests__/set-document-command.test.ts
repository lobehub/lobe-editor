import {
  $createParagraphNode,
  $createTextNode,
  $getRoot,
  $isElementNode,
  COMMAND_PRIORITY_EDITOR,
  createCommand,
} from 'lexical';
import { describe, expect, it } from 'vitest';

import Editor, { moment } from '@/editor-kernel';
import { CommonPlugin } from '@/plugins/common';

describe('Kernel.setDocument inside commands', () => {
  it('replaces after the command transaction, then allows editing and preserves history options', async () => {
    const kernel = Editor.createEditor().registerPlugins([CommonPlugin]);
    kernel.setRootElement(document.createElement('div'));
    const lexicalEditor = kernel.getLexicalEditor()!;
    const replaceDocumentCommand = createCommand<void>('REPLACE_DOCUMENT_FROM_COMMAND');

    try {
      kernel.setDocument('text', 'before');
      lexicalEditor.update(
        () => {
          const edit = $createParagraphNode().append($createTextNode(' prior edit'));
          $getRoot().append(edit);
        },
        { discrete: true },
      );
      expect(kernel.getHistoryState().undoStack.length).toBeGreaterThan(0);

      let commandRan = false;
      let commandError: unknown;
      const unregister = lexicalEditor.registerCommand(
        replaceDocumentCommand,
        () => {
          commandRan = true;
          try {
            kernel.setDocument('text', 'replacement', { keepHistory: true });
          } catch (error) {
            commandError = error;
          }
          return true;
        },
        COMMAND_PRIORITY_EDITOR,
      );

      try {
        const dispatched = lexicalEditor.dispatchCommand(replaceDocumentCommand, undefined);
        expect(commandRan).toBe(true);
        if (commandError instanceof Error) throw commandError;
        expect(commandError).toBeUndefined();
        expect(dispatched).toBe(true);
      } finally {
        unregister();
      }

      await moment();
      expect(kernel.getDocument('text')).toContain('replacement');
      expect(kernel.getHistoryState().undoStack.length).toBeGreaterThan(0);

      lexicalEditor.update(
        () => {
          const lastChild = $getRoot().getLastChild();
          if (!$isElementNode(lastChild)) {
            throw new Error('Expected a paragraph after replacement');
          }
          lastChild.append($createTextNode(' continued'));
        },
        { discrete: true },
      );
      expect(kernel.getDocument('text')).toContain('replacement continued');

      kernel.setDocument('text', 'fresh document');
      expect(kernel.getHistoryState().undoStack).toHaveLength(0);
      expect(kernel.getHistoryState().redoStack).toHaveLength(0);
    } finally {
      kernel.destroy();
    }
  });
});
