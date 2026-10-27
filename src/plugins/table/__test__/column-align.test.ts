import {
  $createTableNodeWithDimensions,
  $isTableNode,
  TableCellNode,
  TableNode,
  TableRowNode,
} from '@lexical/table';
import { $getNodeByKey, $getRoot, createEditor } from 'lexical';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import Editor, { resetRandomKey } from '@/editor-kernel';
import { CommonPlugin } from '@/plugins/common';
import { LitexmlPlugin } from '@/plugins/litexml';
import { MarkdownPlugin } from '@/plugins/markdown';
import { LexicalRenderer } from '@/renderer';
import type { IEditor } from '@/types';

import { SET_TABLE_COLUMN_ALIGN_COMMAND } from '../command';
import {
  $getTableColumnAligns,
  $insertTableColumnAligns,
  $moveTableColumnAligns,
  $removeTableColumnAligns,
  $setTableColumnAligns,
  getTableMarkdownDelimiterRow,
} from '../node/column-align';
import { TablePlugin } from '../plugin';
import { registerTableColumnAlignDOM } from '../plugin/column-align';

const ALIGNED_MARKDOWN =
  '| Name | Qty | Price | Note |\n' +
  '| :--- | :-: | ----: | ---- |\n' +
  '| Apple | 10 | 1.5 | fresh |\n';

const compactXml = (xml: string) =>
  xml.replaceAll(/>\n\s*?</g, '><').replaceAll(/ id="[^"]*"/g, '');

const createKernelEditor = () => {
  const editor = Editor.createEditor();
  editor.registerPlugins([LitexmlPlugin, MarkdownPlugin, CommonPlugin, TablePlugin]);
  editor.initNodeEditor();
  return editor;
};

const readAligns = (editor: IEditor) =>
  editor
    .getLexicalEditor()!
    .getEditorState()
    .read(() => {
      const table = $getRoot().getChildren().find($isTableNode);
      return table ? $getTableColumnAligns(table) : undefined;
    });

describe('table column alignment', () => {
  let editor: IEditor;

  beforeEach(() => {
    resetRandomKey();
    editor = createKernelEditor();
  });

  it('reads GFM delimiter alignment from markdown and writes it back', () => {
    editor.setDocument('markdown', ALIGNED_MARKDOWN);

    expect(readAligns(editor)).toEqual(['left', 'center', 'right']);

    const markdown = editor.getDocument('markdown') as unknown as string;
    const delimiter = markdown.split('\n')[1];
    expect(delimiter).toMatch(/^\| :-+ \| :-+: \| -+: \| -+ \|$/);
  });

  it('writes colAligns next to colWidths in litexml', () => {
    editor.setDocument('markdown', ALIGNED_MARKDOWN);
    const xml = compactXml(editor.getDocument('litexml') as unknown as string);

    expect(xml).toMatch(/<table colWidths="[\d,]+" colAligns="left,center,right">/);
  });

  it('round-trips colAligns with empty entries through litexml', () => {
    editor.setDocument(
      'litexml',
      '<?xml version="1.0" encoding="UTF-8"?><root><table colWidths="100,100,100,100" colAligns="left,center,,right"><tr><td><span>a</span></td><td><span>b</span></td><td><span>c</span></td><td><span>d</span></td></tr></table></root>',
    );

    expect(readAligns(editor)).toEqual(['left', 'center', null, 'right']);
    expect(compactXml(editor.getDocument('litexml') as unknown as string)).toContain(
      '<table colWidths="100,100,100,100" colAligns="left,center,,right">',
    );

    const markdown = editor.getDocument('markdown') as unknown as string;
    expect(markdown.split('\n')[1]).toMatch(/^\| :-+ \| :-+: \| -+ \| -+: \|$/);
  });

  it('stores alignment as node state in JSON and keeps old documents loading', () => {
    editor.setDocument('markdown', ALIGNED_MARKDOWN);
    const json = editor.getDocument('json') as any;
    const table = json.root.children.find((child: any) => child.type === 'table');
    expect(table.$.colAligns).toEqual(['left', 'center', 'right']);

    delete table.$.colAligns;
    const legacy = createKernelEditor();
    legacy.setDocument('json', json);
    expect(readAligns(legacy)).toEqual([]);
    expect(legacy.getDocument('litexml') as unknown as string).not.toContain('colAligns');
  });

  it('omits alignment output for unaligned tables', () => {
    editor.setDocument('markdown', '| a | b |\n| --- | --- |\n| 1 | 2 |\n');

    expect(readAligns(editor)).toEqual([]);
    expect(editor.getDocument('litexml') as unknown as string).not.toContain('colAligns');
    expect((editor.getDocument('markdown') as unknown as string).split('\n')[1]).toMatch(
      /^\| -+ \| -+ \|$/,
    );
  });

  it('sets and toggles alignment with SET_TABLE_COLUMN_ALIGN_COMMAND', () => {
    editor.setDocument('markdown', '| a | b |\n| --- | --- |\n| 1 | 2 |\n');
    const lexical = editor.getLexicalEditor()!;
    const tableKey = lexical
      .getEditorState()
      .read(() => $getRoot().getChildren().find($isTableNode)!.getKey());

    const dispatch = () =>
      lexical.update(
        () => {
          lexical.dispatchCommand(SET_TABLE_COLUMN_ALIGN_COMMAND, {
            align: 'center',
            columnIndexes: [1],
            table: tableKey,
            toggle: true,
          });
        },
        { discrete: true },
      );

    dispatch();
    expect(readAligns(editor)).toEqual([null, 'center']);

    dispatch();
    expect(readAligns(editor)).toEqual([]);
  });

  it('shifts alignment when columns are inserted, removed or moved', () => {
    const lexical = createEditor({ nodes: [TableNode, TableRowNode, TableCellNode] });
    const result: unknown[] = [];

    lexical.update(
      () => {
        const table = $createTableNodeWithDimensions(1, 3, false);
        $getRoot().append(table);
        $setTableColumnAligns(table, ['left', 'center', 'right']);

        $insertTableColumnAligns(table, 1);
        result.push($getTableColumnAligns(table));

        $removeTableColumnAligns(table, 0, 1);
        result.push($getTableColumnAligns(table));

        $setTableColumnAligns(table, ['left', null, 'right']);
        $moveTableColumnAligns(table, 2, 2, 0);
        result.push($getTableColumnAligns(table));
      },
      { discrete: true },
    );

    expect(result).toEqual([
      ['left', null, 'center', 'right'],
      ['center', 'right'],
      ['right', 'left'],
    ]);
  });

  it('builds markdown delimiter rows', () => {
    expect(getTableMarkdownDelimiterRow(4, ['left', 'center', null, 'right'])).toBe(
      '|:--|:-:|---|--:|',
    );
  });

  it('applies alignment to cell DOM in the editor', () => {
    vi.stubGlobal(
      'ResizeObserver',
      class {
        disconnect() {}
        observe() {}
        unobserve() {}
      },
    );
    const lexical = createEditor({ nodes: [TableNode, TableRowNode, TableCellNode] });
    const root = document.createElement('div');
    document.body.append(root);
    lexical.setRootElement(root);
    const unregister = registerTableColumnAlignDOM(lexical);

    let tableKey = '';
    lexical.update(
      () => {
        const table = $createTableNodeWithDimensions(2, 3, false);
        $getRoot().append(table);
        $setTableColumnAligns(table, [null, 'center', 'right']);
        tableKey = table.getKey();
      },
      { discrete: true },
    );

    const alignsOf = () =>
      [...(root.querySelector('tr')?.children ?? [])].map(
        (cell) => (cell as HTMLElement).style.textAlign,
      );
    expect(alignsOf()).toEqual(['', 'center', 'right']);

    lexical.update(
      () => {
        const table = $getNodeByKey(tableKey);
        if ($isTableNode(table)) $setTableColumnAligns(table, []);
      },
      { discrete: true },
    );
    expect(alignsOf()).toEqual(['', '', '']);

    unregister();
    root.remove();
    vi.unstubAllGlobals();
  });

  it('renders column alignment in LexicalRenderer', () => {
    editor.setDocument('markdown', ALIGNED_MARKDOWN);
    const html = renderToStaticMarkup(
      createElement(LexicalRenderer, { value: editor.getDocument('json') as any }),
    );

    expect(html).toContain('text-align:center');
    expect(html).toContain('text-align:right');
    expect(html).toContain('text-align:left');
  });
});
