import {
  $createParagraphNode,
  $createTextNode,
  $getRoot,
  HISTORIC_TAG,
  type LexicalEditor,
} from 'lexical';
import { afterEach, describe, expect, it } from 'vitest';

import Editor from '@/editor-kernel';
import { CommonPlugin } from '@/plugins/common';
import { LitexmlPlugin } from '@/plugins/litexml';
import { $createDiffNode, DiffNode } from '@/plugins/litexml/node/DiffNode';
import { createDiffKeyTracker } from '@/plugins/litexml/react/hooks/useHasDiffNode';
import { isWholeDocumentChange } from '@/plugins/litexml/update-scope';
import { MarkdownPlugin } from '@/plugins/markdown';
import type { IEditor } from '@/types';

const editors: IEditor[] = [];

function createEditor(markdown = 'First\n\nSecond'): LexicalEditor {
  const editor = Editor.createEditor();
  editor.registerPlugins([CommonPlugin, MarkdownPlugin, LitexmlPlugin]);
  editor.initNodeEditor();
  editor.setDocument('markdown', markdown);
  editors.push(editor);
  return editor.getLexicalEditor()!;
}

const appendParagraph = (lexical: LexicalEditor, text: string) =>
  lexical.update(
    () => {
      $getRoot().append($createParagraphNode().append($createTextNode(text)));
    },
    { discrete: true },
  );

const appendDiff = (lexical: LexicalEditor, options?: { skipTransforms: true }) =>
  lexical.update(
    () => {
      const diff = $createDiffNode('modify');
      diff.append($createParagraphNode().append($createTextNode('after')));
      $getRoot().append(diff);
    },
    { discrete: true, ...options },
  );

const readDiffTypes = (lexical: LexicalEditor) =>
  lexical.getEditorState().read(() =>
    $getRoot()
      .getChildren()
      .filter((node): node is DiffNode => node instanceof DiffNode)
      .map((node) => node.diffType),
  );

afterEach(() => {
  editors.splice(0).forEach((editor) => editor.destroy());
});

describe('isWholeDocumentChange', () => {
  it('tells a replaced or restored document from an ordinary edit', () => {
    const lexical = createEditor();
    const seen: boolean[] = [];
    lexical.registerUpdateListener((update) => {
      seen.push(isWholeDocumentChange(update));
    });

    appendParagraph(lexical, 'an edit');
    lexical.setEditorState(lexical.parseEditorState(lexical.getEditorState().toJSON()));
    lexical.update(() => $getRoot().getLastChildOrThrow().remove(), {
      discrete: true,
      tag: HISTORIC_TAG,
    });

    expect(seen).toEqual([false, true, true]);
  });
});

describe('DiffNode normalization listener', () => {
  it('still normalizes a modify diff left with one side by an update that skipped transforms', async () => {
    const lexical = createEditor();
    appendParagraph(lexical, 'settle the first full scan');

    appendDiff(lexical, { skipTransforms: true });
    await Promise.resolve();

    expect(readDiffTypes(lexical)).toEqual(['remove']);
  });

  it('normalizes such a diff in a loaded document', async () => {
    const source = createEditor();
    appendDiff(source, { skipTransforms: true });
    const json = source.getEditorState().toJSON();

    const lexical = createEditor();
    lexical.setEditorState(lexical.parseEditorState(json));
    await Promise.resolve();

    expect(readDiffTypes(lexical)).toEqual(['remove']);
  });
});

describe('createDiffKeyTracker', () => {
  it('follows diff nodes from each update without rescanning', () => {
    const lexical = createEditor();
    const tracker = createDiffKeyTracker(lexical.getEditorState());
    const results: boolean[] = [];
    lexical.registerUpdateListener((update) => {
      results.push(tracker.update(update));
    });

    appendParagraph(lexical, 'plain line');
    appendDiff(lexical);
    lexical.update(
      () => {
        $getRoot()
          .getChildren()
          .filter((node) => node instanceof DiffNode)
          .forEach((node) => node.remove());
      },
      { discrete: true },
    );

    expect(tracker.has()).toBe(false);
    expect(results).toEqual([false, true, false]);
  });

  it('forgets a diff removed together with its parent', () => {
    const lexical = createEditor();
    lexical.update(
      () => {
        const wrapper = $createParagraphNode();
        // Not a valid document shape, but enough to nest a diff below a removed node.
        wrapper.append($createDiffNode('add').append($createTextNode('nested')));
        $getRoot().append(wrapper);
      },
      { discrete: true, skipTransforms: true },
    );
    const tracker = createDiffKeyTracker(lexical.getEditorState());
    expect(tracker.has()).toBe(true);
    lexical.registerUpdateListener((update) => {
      tracker.update(update);
    });

    lexical.update(() => $getRoot().getLastChildOrThrow().remove(), { discrete: true });

    expect(tracker.has()).toBe(false);
  });
});
