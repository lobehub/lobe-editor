import { $isHeadingNode } from '@lexical/rich-text';
import {
  $getRoot,
  $getSelection,
  $isRangeSelection,
  $isTextNode,
  type LexicalEditor,
  type TextNode,
} from 'lexical';
import { afterEach, describe, expect, it, vi } from 'vitest';

import Editor from '@/editor-kernel';
import { CommonPlugin } from '@/plugins/common';
import { MarkdownPlugin } from '@/plugins/markdown';
import {
  IMarkdownShortCutService,
  type MarkdownShortCutService,
} from '@/plugins/markdown/service/shortcut';
import type { IEditor } from '@/types';

const editors: IEditor[] = [];

function createEditor(markdown: string) {
  const editor = Editor.createEditor();
  editor.registerPlugins([CommonPlugin, MarkdownPlugin]);
  editor.initNodeEditor();
  editor.setDocument('markdown', markdown);
  editors.push(editor);
  const lexical = editor.getLexicalEditor()!;
  lexical.update(() => $getRoot().selectEnd(), { discrete: true });
  return { editor, lexical };
}

/** Type one character at the caret as its own committed update, like a keystroke. */
const type = (lexical: LexicalEditor, text: string) =>
  lexical.update(
    () => {
      const selection = $getSelection();
      if ($isRangeSelection(selection)) selection.insertText(text);
    },
    { discrete: true },
  );

afterEach(() => {
  editors.splice(0).forEach((editor) => editor.destroy());
});

describe('mayRunTransformers', () => {
  it('rules out ordinary characters and keeps shortcut triggers', () => {
    const { editor, lexical } = createEditor('placeholder');
    const service = editor.requireService(
      IMarkdownShortCutService,
    ) as unknown as MarkdownShortCutService;
    const check = (offset: number) =>
      lexical.getEditorState().read(() => {
        const text = $getRoot().getFirstDescendant();
        if (!$isTextNode(text)) throw new Error('Expected a text node.');
        return service.mayRunTransformers(text.getParentOrThrow(), text, offset);
      });

    lexical.update(
      () => $getRoot().getFirstDescendant<TextNode>()!.setTextContent('# plain **bold** x'),
      {
        discrete: true,
      },
    );

    expect(check(2)).toBe(true); // "# " opens a heading
    expect(check(7)).toBe(false); // "...plain"
    expect(check(16)).toBe(true); // closing "**"
    expect(check(18)).toBe(false); // "x"
  });
});

describe('markdown shortcut listener', () => {
  it('does not open an update for a keystroke that cannot complete a shortcut', () => {
    const { lexical } = createEditor('Some text');
    const update = vi.spyOn(lexical, 'update');

    type(lexical, 'a');

    expect(update).toHaveBeenCalledTimes(1); // only the keystroke itself
  });

  it('still converts a heading shortcut while typing', async () => {
    const { lexical } = createEditor('Title');
    lexical.update(
      () => {
        const text = $getRoot().getFirstDescendant<TextNode>()!;
        text.setTextContent('#');
        text.selectEnd();
      },
      { discrete: true },
    );

    type(lexical, ' ');
    await Promise.resolve();

    expect(lexical.getEditorState().read(() => $isHeadingNode($getRoot().getFirstChild()))).toBe(
      true,
    );
  });
});
