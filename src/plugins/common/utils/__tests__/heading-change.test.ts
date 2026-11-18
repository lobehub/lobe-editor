import { $createHeadingNode, $createQuoteNode, $isHeadingNode } from '@lexical/rich-text';
import {
  $createParagraphNode,
  $createTextNode,
  $getRoot,
  type ElementNode,
  type LexicalEditor,
  type TextNode,
} from 'lexical';
import { afterEach, describe, expect, it } from 'vitest';

import Editor from '@/editor-kernel';
import { CommonPlugin } from '@/plugins/common';
import { hasHeadingChange } from '@/plugins/common/utils/heading-change';
import { MarkdownPlugin } from '@/plugins/markdown';
import type { IEditor } from '@/types';

const editors: IEditor[] = [];

function createEditor(markdown: string): LexicalEditor {
  const editor = Editor.createEditor();
  editor.registerPlugins([CommonPlugin, MarkdownPlugin]);
  editor.initNodeEditor();
  editor.setDocument('markdown', markdown);
  editors.push(editor);
  return editor.getLexicalEditor()!;
}

/** Run one discrete update and report what hasHeadingChange says about its commit. */
function headingChanged(lexical: LexicalEditor, update: () => void): boolean {
  let changed: boolean | undefined;
  const unregister = lexical.registerUpdateListener(
    ({ dirtyElements, dirtyLeaves, editorState, prevEditorState }) => {
      changed ??= hasHeadingChange(editorState, prevEditorState, dirtyElements, dirtyLeaves);
    },
  );
  lexical.update(update, { discrete: true });
  unregister();
  return changed ?? false;
}

afterEach(() => {
  editors.splice(0).forEach((editor) => editor.destroy());
});

describe('hasHeadingChange', () => {
  const doc = '# Intro\n\nBody text\n\n## Usage\n\nMore text';

  it('ignores a new line appended after the headings', () => {
    const lexical = createEditor(doc);

    expect(
      headingChanged(lexical, () => {
        const paragraph = $createParagraphNode();
        paragraph.append($createTextNode('a new line'));
        $getRoot().append(paragraph);
      }),
    ).toBe(false);
  });

  it('ignores typing in a paragraph', () => {
    const lexical = createEditor(doc);

    expect(
      headingChanged(lexical, () => {
        $getRoot()
          .getChildAtIndex<ElementNode>(1)!
          .getFirstDescendant<TextNode>()!
          .setTextContent('Body text!');
      }),
    ).toBe(false);
  });

  it('reports typing in a heading', () => {
    const lexical = createEditor(doc);

    expect(
      headingChanged(lexical, () => {
        const heading = $getRoot().getFirstChildOrThrow<ElementNode>();
        heading.getFirstDescendant<TextNode>()!.setTextContent('Introduction');
      }),
    ).toBe(true);
  });

  it('reports a removed block that contained a heading', () => {
    const lexical = createEditor('Body');
    lexical.update(
      () => {
        const quote = $createQuoteNode();
        quote.append($createHeadingNode('h2').append($createTextNode('Nested')));
        $getRoot().append(quote);
      },
      { discrete: true },
    );

    expect(headingChanged(lexical, () => $getRoot().getLastChildOrThrow().remove())).toBe(true);
  });

  it('reports a moved block that contains a heading', () => {
    const lexical = createEditor('Body');
    lexical.update(
      () => {
        const quote = $createQuoteNode();
        quote.append($createHeadingNode('h2').append($createTextNode('Nested')));
        $getRoot().append(quote);
      },
      { discrete: true },
    );

    expect(
      headingChanged(lexical, () => {
        const root = $getRoot();
        root.getFirstChildOrThrow().insertBefore(root.getLastChildOrThrow());
      }),
    ).toBe(true);
  });

  it('reports a replaced document', () => {
    const lexical = createEditor(doc);
    const replacement = createEditor('# Other');
    let changed: boolean | undefined;
    const unregister = lexical.registerUpdateListener(
      ({ dirtyElements, dirtyLeaves, editorState, prevEditorState }) => {
        changed ??= hasHeadingChange(editorState, prevEditorState, dirtyElements, dirtyLeaves);
      },
    );
    lexical.setEditorState(lexical.parseEditorState(replacement.getEditorState().toJSON()));
    unregister();

    expect(changed).toBe(true);
    expect(lexical.getEditorState().read(() => $isHeadingNode($getRoot().getFirstChild()))).toBe(
      true,
    );
  });
});
