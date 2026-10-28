import { $isTableNode } from '@lexical/table';
import { $getRoot } from 'lexical';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import Editor, { resetRandomKey } from '@/editor-kernel';
import { CommonPlugin } from '@/plugins/common';
import { LitexmlPlugin } from '@/plugins/litexml';
import { MarkdownPlugin } from '@/plugins/markdown';
import type { IEditor } from '@/types';

import {
  DISTRIBUTE_TABLE_COLUMN_WIDTH_COMMAND,
  INSERT_TABLE_COMMAND,
  SYNC_TABLE_COLUMN_WIDTH_COMMAND,
} from '../command';
import { TablePlugin } from '../plugin';

globalThis.ResizeObserver ??= class {
  disconnect() {}
  observe() {}
  unobserve() {}
} as unknown as typeof ResizeObserver;

const createKernelEditor = () => {
  const editor = Editor.createEditor();
  editor.registerPlugins([LitexmlPlugin, MarkdownPlugin, CommonPlugin, TablePlugin]);
  editor.initNodeEditor();
  return editor;
};

const readColWidths = (editor: IEditor) =>
  editor
    .getLexicalEditor()!
    .getEditorState()
    .read(() => $getRoot().getChildren().find($isTableNode)?.getColWidths());

describe('tables without saved widths', () => {
  let editor: IEditor;

  beforeEach(() => {
    resetRandomKey();
    editor = createKernelEditor();
  });

  it('inserts a table without column widths', () => {
    editor.setDocument('text', 'hello');
    const lexical = editor.getLexicalEditor()!;
    lexical.update(
      () => {
        $getRoot().selectEnd();
        lexical.dispatchCommand(INSERT_TABLE_COMMAND, {
          columns: '3',
          includeHeaders: true,
          rows: '2',
        });
      },
      { discrete: true },
    );

    const state = lexical.getEditorState();
    expect(state.read(() => $getRoot().getChildren().some($isTableNode))).toBe(true);
    expect(readColWidths(editor)).toBeUndefined();
  });

  it('reads a Markdown table without column widths', () => {
    editor.setDocument('markdown', '| a | b |\n| --- | --- |\n| 1 | 2 |\n');

    expect(readColWidths(editor)).toBeUndefined();
  });

  it('reads a LiteXML table without colWidths as fluid', () => {
    editor.setDocument(
      'litexml',
      '<root><table><tr><td><p>a</p></td><td><p>b</p></td></tr></table></root>',
    );

    expect(readColWidths(editor)).toBeUndefined();
  });

  it('keeps LiteXML colWidths', () => {
    editor.setDocument(
      'litexml',
      '<root><table colWidths="100,200"><tr><td><p>a</p></td><td><p>b</p></td></tr></table></root>',
    );

    expect(readColWidths(editor)).toEqual([100, 200]);
  });
});

describe('width commands on fluid tables', () => {
  let editor: IEditor;
  let editorRoot: HTMLDivElement;

  const lexical = () => editor.getLexicalEditor()!;

  const tableKey = () =>
    lexical()
      .getEditorState()
      .read(() => $getRoot().getChildren().find($isTableNode)!.getKey());

  const dispatch = (run: (key: string) => void) =>
    lexical().update(() => run(tableKey()), { discrete: true });

  const setWidths = (widths: number[] | undefined) =>
    lexical().update(() => $getRoot().getChildren().find($isTableNode)!.setColWidths(widths), {
      discrete: true,
    });

  beforeEach(() => {
    resetRandomKey();
    vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(600);
    vi.spyOn(Element.prototype, 'getBoundingClientRect').mockReturnValue({
      bottom: 40,
      height: 40,
      left: 0,
      right: 120,
      toJSON: () => ({}),
      top: 0,
      width: 120,
      x: 0,
      y: 0,
    } as DOMRect);
    editor = createKernelEditor();
    editorRoot = document.createElement('div');
    editorRoot.contentEditable = 'true';
    document.body.append(editorRoot);
    lexical().setRootElement(editorRoot);
    editor.setDocument('markdown', '| a | b | c |\n| --- | --- | --- |\n| 1 | 2 | 3 |\n');
  });

  afterEach(() => {
    lexical().setRootElement(null);
    editorRoot.remove();
    vi.restoreAllMocks();
  });

  it('keeps a loaded table fluid after LiteXML width normalization', async () => {
    await Promise.resolve();
    await Promise.resolve();

    expect(readColWidths(editor)).toBeUndefined();
  });

  it('marks the table element as fluid until it gets widths', () => {
    const table = () => editorRoot.querySelector('table')!;
    expect(table().dataset.lobeTableFluid).toBe('true');

    setWidths([100, 100, 100]);

    expect(table().dataset.lobeTableFluid).toBeUndefined();
  });

  it('keeps a fluid table fluid when distributing evenly', () => {
    dispatch((table) =>
      lexical().dispatchCommand(DISTRIBUTE_TABLE_COLUMN_WIDTH_COMMAND, { table }),
    );

    expect(readColWidths(editor)).toBeUndefined();
  });

  it('clears saved widths when distributing evenly and the columns fit', () => {
    setWidths([400, 400, 400]);
    dispatch((table) =>
      lexical().dispatchCommand(DISTRIBUTE_TABLE_COLUMN_WIDTH_COMMAND, { table }),
    );

    expect(readColWidths(editor)).toBeUndefined();
  });

  it('writes widths when distributing columns that do not fit the column', () => {
    vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(200);
    setWidths([400, 400, 400]);
    dispatch((table) =>
      lexical().dispatchCommand(DISTRIBUTE_TABLE_COLUMN_WIDTH_COMMAND, { table }),
    );

    expect(readColWidths(editor)).toEqual([75, 75, 75]);
  });

  it('syncs a fluid table from its rendered widths', () => {
    dispatch((table) =>
      lexical().dispatchCommand(SYNC_TABLE_COLUMN_WIDTH_COMMAND, { columnIndex: 0, table }),
    );

    expect(readColWidths(editor)).toEqual([120, 120, 120]);
  });
});
