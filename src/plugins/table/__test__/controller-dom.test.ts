import { $isTableNode } from '@lexical/table';
import { $getRoot } from 'lexical';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import Editor from '@/editor-kernel';
import { CommonPlugin } from '@/plugins/common';
import { MarkdownPlugin } from '@/plugins/markdown';
import type { IEditor } from '@/types';

import { TablePlugin } from '../plugin';

globalThis.ResizeObserver ??= class {
  disconnect() {}
  observe() {}
  unobserve() {}
} as unknown as typeof ResizeObserver;

describe('table controller hosts', () => {
  let editor: IEditor;
  let editorRoot: HTMLDivElement;

  const tableRoot = () =>
    editorRoot.querySelector<HTMLElement>('.editor_table_scrollable_wrapper')!;
  const scrollWrapper = () =>
    tableRoot().querySelector<HTMLElement>('.lobe-editor-table-scroll-wrapper')!;
  const hostParents = () =>
    ['.toolbar-col', '.toolbar-row'].map(
      (selector) => tableRoot().querySelector(selector)?.parentElement,
    );

  beforeEach(() => {
    editor = Editor.createEditor();
    editor.registerPlugins([CommonPlugin, MarkdownPlugin, TablePlugin]);
    editor.initNodeEditor();
    editorRoot = document.createElement('div');
    editorRoot.contentEditable = 'true';
    document.body.append(editorRoot);
    editor.getLexicalEditor()!.setRootElement(editorRoot);
    editor.setDocument('markdown', '| a | b |\n| --- | --- |\n| 1 | 2 |\n');
  });

  afterEach(() => {
    editor.getLexicalEditor()!.setRootElement(null);
    editorRoot.remove();
  });

  it('mounts the grip hosts outside the scroll wrapper', () => {
    expect(hostParents()).toEqual([tableRoot(), tableRoot()]);
    expect(
      scrollWrapper().querySelector(':scope > .toolbar-col, :scope > .toolbar-row'),
    ).toBeNull();
  });

  it('moves hosts left inside the scroll wrapper out on update', () => {
    for (const host of tableRoot().querySelectorAll(
      ':scope > .toolbar-col, :scope > .toolbar-row',
    )) {
      scrollWrapper().append(host);
    }

    const lexical = editor.getLexicalEditor()!;
    lexical.update(() => $getRoot().getChildren().find($isTableNode)!.setColWidths([100, 100]), {
      discrete: true,
    });

    expect(hostParents()).toEqual([tableRoot(), tableRoot()]);
  });
});
