// @vitest-environment node
import { $createQuoteNode } from '@lexical/rich-text';
import { $createParagraphNode, $createTextNode, $getRoot, KEY_BACKSPACE_COMMAND } from 'lexical';
import { describe, expect, it, vi } from 'vitest';

import Editor from '@/editor-kernel';
import { CommonPlugin } from '@/plugins/common';

function createKeyboardEventMock() {
  return {
    preventDefault: vi.fn(),
    stopImmediatePropagation: vi.fn(),
    stopPropagation: vi.fn(),
  } as unknown as KeyboardEvent;
}

async function flushEditorUpdates() {
  await Promise.resolve();
  await Promise.resolve();
}

describe('common plugin keyboard registration', () => {
  it('converts a leading quote block to a normal paragraph on backspace', async () => {
    const editor = Editor.createEditor().registerPlugins([CommonPlugin]);
    editor.initNodeEditor();

    const lexicalEditor = editor.getLexicalEditor();
    if (!lexicalEditor) {
      throw new Error('Lexical editor not initialized');
    }

    lexicalEditor.update(
      () => {
        const quoteNode = $createQuoteNode();
        const paragraphNode = $createParagraphNode();
        const textNode = $createTextNode('quoted text');

        paragraphNode.append(textNode);
        quoteNode.append(paragraphNode);
        $getRoot().clear().append(quoteNode);
        textNode.select(0, 0);
      },
      { discrete: true },
    );

    const event = createKeyboardEventMock();
    lexicalEditor.dispatchCommand(KEY_BACKSPACE_COMMAND, event);
    await flushEditorUpdates();

    const document = editor.getDocument('json') as any;
    expect(document.root.children).toHaveLength(1);
    expect(document.root.children[0].type).toBe('paragraph');
    expect(document.root.children[0].children[0].text).toBe('quoted text');
    expect(event.preventDefault).toHaveBeenCalledTimes(1);
    expect(event.stopPropagation).toHaveBeenCalledTimes(1);
    expect(event.stopImmediatePropagation).toHaveBeenCalledTimes(1);
  });

  it('converts an empty leading quote block to an empty paragraph on backspace', async () => {
    const editor = Editor.createEditor().registerPlugins([CommonPlugin]);
    editor.initNodeEditor();

    const lexicalEditor = editor.getLexicalEditor();
    if (!lexicalEditor) {
      throw new Error('Lexical editor not initialized');
    }

    lexicalEditor.update(
      () => {
        const quoteNode = $createQuoteNode();

        $getRoot().clear().append(quoteNode);
        quoteNode.select(0, 0);
      },
      { discrete: true },
    );

    const event = createKeyboardEventMock();
    lexicalEditor.dispatchCommand(KEY_BACKSPACE_COMMAND, event);
    await flushEditorUpdates();

    const document = editor.getDocument('json') as any;
    expect(document.root.children).toHaveLength(1);
    expect(document.root.children[0].type).toBe('paragraph');
    expect(event.preventDefault).toHaveBeenCalledTimes(1);
  });

  it('does not convert quote block when cursor is not at the quote start', async () => {
    const editor = Editor.createEditor().registerPlugins([CommonPlugin]);
    editor.initNodeEditor();

    const lexicalEditor = editor.getLexicalEditor();
    if (!lexicalEditor) {
      throw new Error('Lexical editor not initialized');
    }

    lexicalEditor.update(
      () => {
        const quoteNode = $createQuoteNode();
        const paragraphNode = $createParagraphNode();
        const textNode = $createTextNode('quoted text');

        paragraphNode.append(textNode);
        quoteNode.append(paragraphNode);
        $getRoot().clear().append(quoteNode);
        textNode.select(3, 3);
      },
      { discrete: true },
    );

    const event = createKeyboardEventMock();
    lexicalEditor.dispatchCommand(KEY_BACKSPACE_COMMAND, event);
    await flushEditorUpdates();

    const document = editor.getDocument('json') as any;
    expect(document.root.children).toHaveLength(1);
    expect(document.root.children[0].type).toBe('quote');
  });

  it('does not convert quote block at the start of a later paragraph', async () => {
    const editor = Editor.createEditor().registerPlugins([CommonPlugin]);
    editor.initNodeEditor();

    const lexicalEditor = editor.getLexicalEditor();
    if (!lexicalEditor) {
      throw new Error('Lexical editor not initialized');
    }

    lexicalEditor.update(
      () => {
        const quoteNode = $createQuoteNode();
        const firstParagraph = $createParagraphNode();
        const secondParagraph = $createParagraphNode();
        const firstTextNode = $createTextNode('first quote paragraph');
        const secondTextNode = $createTextNode('second quote paragraph');

        firstParagraph.append(firstTextNode);
        secondParagraph.append(secondTextNode);
        quoteNode.append(firstParagraph, secondParagraph);
        $getRoot().clear().append(quoteNode);
        secondTextNode.select(0, 0);
      },
      { discrete: true },
    );

    const event = createKeyboardEventMock();
    lexicalEditor.dispatchCommand(KEY_BACKSPACE_COMMAND, event);
    await flushEditorUpdates();

    const document = editor.getDocument('json') as any;
    expect(document.root.children).toHaveLength(1);
    expect(document.root.children[0].type).toBe('quote');
  });
});
