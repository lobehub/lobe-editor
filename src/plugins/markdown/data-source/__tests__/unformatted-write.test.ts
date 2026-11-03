import { CommonPlugin } from '@lobehub/editor';
import { $createLineBreakNode, $createParagraphNode, $createTextNode, $getRoot } from 'lexical';
import { describe, expect, it } from 'vitest';

import Editor from '@/editor-kernel';

import { MarkdownPlugin } from '../../plugin';

const PROMPT = [
  '# Role',
  'You are a **terse** reviewer.',
  '* Compute 2 * 3 and cite [the answer]',
  '    keep this indented line',
  '1. Read the diff.',
  '2. Reply with `bullets` only',
].join('\n');

const createEditorWith = (build: () => void) => {
  const editor = Editor.createEditor().registerPlugins([CommonPlugin, MarkdownPlugin]);
  editor.initNodeEditor();
  editor.getLexicalEditor()!.update(build, { discrete: true });
  return editor;
};

const singleTextNode = (text: string) => () => {
  const paragraph = $createParagraphNode();
  paragraph.append($createTextNode(text));
  $getRoot().clear().append(paragraph);
};

const textWithLineBreaks = (text: string) => () => {
  const paragraph = $createParagraphNode();
  text.split('\n').forEach((line, index) => {
    if (index > 0) paragraph.append($createLineBreakNode());
    paragraph.append($createTextNode(line));
  });
  $getRoot().clear().append(paragraph);
};

describe('markdown write with format: false', () => {
  it('returns plain text pasted as one text node verbatim', () => {
    const editor = createEditorWith(singleTextNode(PROMPT));

    expect(String(editor.getDocument('markdown', { format: false })).trimEnd()).toBe(PROMPT);
  });

  it('returns lines separated by line breaks verbatim', () => {
    const editor = createEditorWith(textWithLineBreaks(PROMPT));

    expect(String(editor.getDocument('markdown', { format: false })).trimEnd()).toBe(PROMPT);
  });

  it('still separates emphasis that ends in punctuation from the next word', () => {
    const editor = createEditorWith(() => {
      const paragraph = $createParagraphNode();
      paragraph.append($createTextNode('Note.').toggleFormat('bold'), $createTextNode('Next'));
      $getRoot().clear().append(paragraph);
    });

    expect(String(editor.getDocument('markdown', { format: false })).trimEnd()).toBe(
      '**Note.** Next',
    );
  });

  it('keeps formatting the export by default', () => {
    const editor = createEditorWith(singleTextNode('Compute 2 * 3'));

    expect(String(editor.getDocument('markdown')).trim()).toBe('Compute 2 \\* 3');
  });
});
