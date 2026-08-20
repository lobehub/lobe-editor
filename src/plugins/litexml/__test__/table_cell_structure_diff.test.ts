import { resetRandomKey } from 'lexical';
import { beforeEach, describe, expect, it } from 'vitest';

import Editor, { moment } from '@/editor-kernel';
import { CommonPlugin } from '@/plugins/common';
import {
  DiffAction,
  LITEXML_DIFFNODE_ALL_COMMAND,
  LITEXML_MODIFY_COMMAND,
  LitexmlPlugin,
} from '@/plugins/litexml';
import { MarkdownPlugin } from '@/plugins/markdown';
import { TablePlugin } from '@/plugins/table/plugin';
import type { IEditor } from '@/types';

import { $normalizeLegacyTableCellDiffs } from '../table-cell-diff';

const source = `<?xml version="1.0" encoding="UTF-8"?><root><table id="itfs" colWidths="250,250,250"><tr id="iz03"><td id="j4ke"><p>名称</p></td><td id="jl9b"><p>数量</p></td><td id="k1y8"><p>备注</p></td></tr><tr id="kin5"><td id="ko7g"><p>橙子</p></td><td id="l4wd"><p>30</p></td><td id="llla"><p>整体修改</p></td></tr><tr id="m2a7"><td id="m7ui"><p>苹果</p></td><td id="mzo1"><p>50</p></td><td id="nrhk"><p>随机填写</p></td></tr></table></root>`;

const insertTwoColumns = [
  {
    action: 'insert' as const,
    afterId: 'k1y8',
    litexml: '<root><td><p>单价</p></td><td><p>总价</p></td></root>',
  },
  {
    action: 'insert' as const,
    afterId: 'llla',
    litexml: '<root><td><p>5</p></td><td><p>150</p></td></root>',
  },
  {
    action: 'insert' as const,
    afterId: 'nrhk',
    litexml: '<root><td><p>8</p></td><td><p>400</p></td></root>',
  },
];

const removeLastColumn = [
  { action: 'remove' as const, id: 'k1y8' },
  { action: 'remove' as const, id: 'llla' },
  { action: 'remove' as const, id: 'nrhk' },
];

const getTable = (editor: IEditor): any => (editor.getDocument('json') as any).root.children[0];
const getRows = (editor: IEditor): any[] => getTable(editor).children;
const getText = (node: any): string =>
  typeof node?.text === 'string'
    ? node.text
    : Array.isArray(node?.children)
      ? node.children.map(getText).join('\n')
      : '';

const assertRowsContainOnlyCells = (rows: any[]) => {
  expect(rows.every((row) => row.type === 'tablerow')).toBe(true);
  expect(
    rows.every((row) =>
      row.children.every(
        (child: any) => child.type === 'tablecell' || child.type === 'table-cell-diff',
      ),
    ),
  ).toBe(true);
  expect(rows.some((row) => row.children.some((child: any) => child.type === 'diff'))).toBe(false);
};

const createLegacyCellDiffJson = (
  editor: IEditor,
  diffType: 'add' | 'remove',
  cellGroups: string[][],
) => {
  const json = structuredClone(editor.getDocument('json') as any);
  const table = json.root.children[0];

  table.children.forEach((row: any, rowIndex: number) => {
    const cells = cellGroups[rowIndex].map((text) => ({
      children: [
        {
          children: [
            { detail: 0, format: 0, mode: 'normal', style: '', text, type: 'text', version: 1 },
          ],
          direction: null,
          format: '',
          indent: 0,
          textFormat: 0,
          textStyle: '',
          type: 'paragraph',
          version: 1,
        },
      ],
      colSpan: 1,
      direction: null,
      format: '',
      headerState: 0,
      indent: 0,
      rowSpan: 1,
      type: 'tablecell',
      version: 1,
    }));
    row.children.push({
      children: cells,
      diffType,
      direction: null,
      format: '',
      indent: 0,
      type: 'diff',
      version: 1,
    });
  });

  return json;
};

describe('LiteXML structural table cell diffs', () => {
  let editor: IEditor;

  beforeEach(() => {
    resetRandomKey();
    editor = Editor.createEditor();
    editor.registerPlugins([LitexmlPlugin, MarkdownPlugin, CommonPlugin, TablePlugin]);
    editor.initNodeEditor();
    editor.setDocument('litexml', source);
  });

  const stage = async (operations: Parameters<IEditor['dispatchCommand']>[1]) => {
    editor.dispatchCommand(LITEXML_MODIFY_COMMAND, operations as any);
    await moment();
  };

  const resolveAll = async (action: DiffAction) => {
    editor.dispatchCommand(LITEXML_DIFFNODE_ALL_COMMAND, { action });
    await moment();
  };

  it('keeps tr > td structure when inserting two cells into every row', async () => {
    await stage(insertTwoColumns);

    const table = getTable(editor);
    const rows = getRows(editor);
    assertRowsContainOnlyCells(rows);
    expect(table.colWidths).toEqual([250, 250, 250, 250, 250]);
    expect(rows.map((row) => row.children.length)).toEqual([5, 5, 5]);
    rows.forEach((row) => {
      expect(row.children.slice(3).map((cell: any) => cell.type)).toEqual([
        'table-cell-diff',
        'table-cell-diff',
      ]);
      expect(row.children.slice(3).map((cell: any) => cell.diffType)).toEqual(['add', 'add']);
      expect(row.children.slice(3).map((cell: any) => cell.children[0].type)).toEqual([
        'diff',
        'diff',
      ]);
    });
    expect(rows.map((row) => row.children.slice(3).map(getText))).toEqual([
      ['单价', '总价'],
      ['5', '150'],
      ['8', '400'],
    ]);
  });

  it('accepts all inserted cells as ordinary td nodes and preserves both columns', async () => {
    await stage(insertTwoColumns);
    await resolveAll(DiffAction.Accept);

    const table = getTable(editor);
    const rows = getRows(editor);
    assertRowsContainOnlyCells(rows);
    expect(table.colWidths).toEqual([250, 250, 250, 250, 250]);
    expect(rows.map((row) => row.children.map((cell: any) => cell.type))).toEqual([
      Array.from({ length: 5 }, () => 'tablecell'),
      Array.from({ length: 5 }, () => 'tablecell'),
      Array.from({ length: 5 }, () => 'tablecell'),
    ]);
    expect(rows.map((row) => row.children.slice(3).map(getText))).toEqual([
      ['单价', '总价'],
      ['5', '150'],
      ['8', '400'],
    ]);
  });

  it('rejects all inserted cells and restores the original three-column table', async () => {
    await stage(insertTwoColumns);
    await resolveAll(DiffAction.Reject);

    const table = getTable(editor);
    const rows = getRows(editor);
    assertRowsContainOnlyCells(rows);
    expect(table.colWidths).toEqual([250, 250, 250]);
    expect(rows.map((row) => row.children.length)).toEqual([3, 3, 3]);
    expect(rows.map((row) => row.children.map(getText))).toEqual([
      ['名称', '数量', '备注'],
      ['橙子', '30', '整体修改'],
      ['苹果', '50', '随机填写'],
    ]);
  });

  it('stages deletion as structural td nodes and accepts a complete deleted column', async () => {
    await stage(removeLastColumn);

    let table = getTable(editor);
    let rows = getRows(editor);
    assertRowsContainOnlyCells(rows);
    expect(table.colWidths).toEqual([250, 250, 250]);
    rows.forEach((row) => {
      expect(row.children[2]).toMatchObject({ diffType: 'remove', type: 'table-cell-diff' });
      expect(row.children[2].children[0]).toMatchObject({ diffType: 'remove', type: 'diff' });
    });

    await resolveAll(DiffAction.Accept);
    table = getTable(editor);
    rows = getRows(editor);
    assertRowsContainOnlyCells(rows);
    expect(table.colWidths).toEqual([250, 250]);
    expect(rows.map((row) => row.children.length)).toEqual([2, 2, 2]);
    expect(rows.map((row) => row.children.map(getText))).toEqual([
      ['名称', '数量'],
      ['橙子', '30'],
      ['苹果', '50'],
    ]);
  });

  it('rejects cell deletion and restores ordinary td nodes', async () => {
    await stage(removeLastColumn);
    await resolveAll(DiffAction.Reject);

    const table = getTable(editor);
    const rows = getRows(editor);
    assertRowsContainOnlyCells(rows);
    expect(table.colWidths).toEqual([250, 250, 250]);
    expect(rows.map((row) => row.children.map((cell: any) => cell.type))).toEqual([
      ['tablecell', 'tablecell', 'tablecell'],
      ['tablecell', 'tablecell', 'tablecell'],
      ['tablecell', 'tablecell', 'tablecell'],
    ]);
  });

  it('removes only one td without shrinking shared table widths or breaking sibling rows', async () => {
    await stage([{ action: 'remove', id: 'llla' }]);

    let table = getTable(editor);
    let rows = getRows(editor);
    assertRowsContainOnlyCells(rows);
    expect(table.colWidths).toEqual([250, 250, 250]);
    expect(rows.map((row) => row.children.length)).toEqual([3, 3, 3]);
    expect(rows[1].children[2]).toMatchObject({ diffType: 'remove', type: 'table-cell-diff' });

    await resolveAll(DiffAction.Accept);
    table = getTable(editor);
    rows = getRows(editor);
    assertRowsContainOnlyCells(rows);
    expect(table.colWidths).toEqual([250, 250, 250]);
    expect(rows.map((row) => row.children.length)).toEqual([3, 2, 3]);
    expect(rows[1].children.map(getText)).toEqual(['橙子', '30']);
  });

  it('exports the proposed inserted and removed columns as valid applied LiteXML', async () => {
    await stage(insertTwoColumns);
    let litexml = editor.getDocument('litexml') as unknown as string;
    expect(litexml.match(/<tr\b/g)).toHaveLength(3);
    expect(litexml.match(/<td\b/g)).toHaveLength(15);
    expect(litexml).toContain('单价');
    expect(litexml).toContain('400');

    editor.setDocument('litexml', source);
    await stage(removeLastColumn);
    litexml = editor.getDocument('litexml') as unknown as string;
    expect(litexml.match(/<tr\b/g)).toHaveLength(3);
    expect(litexml.match(/<td\b/g)).toHaveLength(6);
    expect(litexml).not.toContain('整体修改');
    expect(litexml).not.toContain('随机填写');
  });

  it('preserves multiple block children in an inserted td across JSON reload and approval', async () => {
    await stage([
      {
        action: 'insert',
        afterId: 'k1y8',
        litexml: '<td><p>第一行</p><p>第二行</p><p>第三行</p></td>',
      },
    ]);

    const stagedJson = editor.getDocument('json');
    expect(getRows(editor)[0].children[3]).toMatchObject({
      diffType: 'add',
      type: 'table-cell-diff',
    });
    editor.setDocument('json', stagedJson, { keepId: true });
    await moment();
    expect(getRows(editor)[0].children[3].children[0].children).toHaveLength(3);

    await resolveAll(DiffAction.Accept);
    const cell = getRows(editor)[0].children[3];
    expect(cell.type).toBe('tablecell');
    expect(cell.children).toHaveLength(3);
    expect(cell.children.map(getText)).toEqual(['第一行', '第二行', '第三行']);
  });

  it('migrates one legacy added td per diff and extends table widths', async () => {
    editor.setDocument(
      'json',
      createLegacyCellDiffJson(editor, 'add', [['单价'], ['5元'], ['8元']]),
    );
    await moment();

    const table = getTable(editor);
    const rows = getRows(editor);
    assertRowsContainOnlyCells(rows);
    expect(table.colWidths).toEqual([250, 250, 250, 250]);
    rows.forEach((row) => {
      expect(row.children[3]).toMatchObject({ diffType: 'add', type: 'table-cell-diff' });
    });
    expect(rows.map((row) => getText(row.children[3]))).toEqual(['单价', '5元', '8元']);
  });

  it('expands two legacy td children into adjacent cell diffs and pads 3 widths to 5', async () => {
    editor.setDocument(
      'json',
      createLegacyCellDiffJson(editor, 'add', [
        ['单价', '状态'],
        ['5元', '已上架'],
        ['8元', '已下架'],
      ]),
    );
    await moment();

    const table = getTable(editor);
    const rows = getRows(editor);
    assertRowsContainOnlyCells(rows);
    expect(table.colWidths).toEqual([250, 250, 250, 250, 250]);
    expect(rows.map((row) => row.children.length)).toEqual([5, 5, 5]);
    expect(rows.map((row) => row.children.slice(3).map(getText))).toEqual([
      ['单价', '状态'],
      ['5元', '已上架'],
      ['8元', '已下架'],
    ]);
  });

  it.each([
    ['add', DiffAction.Accept, 4, '新增列'],
    ['add', DiffAction.Reject, 3, undefined],
    ['remove', DiffAction.Accept, 3, undefined],
    ['remove', DiffAction.Reject, 4, '待删除列'],
  ] as const)(
    'supports %s legacy cells after %s',
    async (diffType, action, expectedColumns, expectedText) => {
      editor.setDocument(
        'json',
        createLegacyCellDiffJson(editor, diffType, [
          [diffType === 'add' ? '新增列' : '待删除列'],
          ['值 1'],
          ['值 2'],
        ]),
      );
      await moment();
      await resolveAll(action);

      const rows = getRows(editor);
      assertRowsContainOnlyCells(rows);
      expect(rows.map((row) => row.children.length)).toEqual(
        Array.from({ length: 3 }, () => expectedColumns),
      );
      if (expectedText) expect(getText(rows[0].children[3])).toBe(expectedText);
    },
  );

  it('stays structurally valid and unchanged after JSON reload and repeated normalization', async () => {
    editor.setDocument(
      'json',
      createLegacyCellDiffJson(editor, 'add', [
        ['单价', '状态'],
        ['5元', '已上架'],
        ['8元', '已下架'],
      ]),
    );
    await moment();
    const migratedJson = editor.getDocument('json');

    editor.setDocument('json', migratedJson, { keepId: true });
    await moment();
    const reloadedJson = editor.getDocument('json');
    const normalizationResults: boolean[] = [];
    editor.getLexicalEditor()!.update(
      () => {
        normalizationResults.push($normalizeLegacyTableCellDiffs(editor.getLexicalEditor()!));
        normalizationResults.push($normalizeLegacyTableCellDiffs(editor.getLexicalEditor()!));
      },
      { discrete: true },
    );

    expect(reloadedJson).toEqual(migratedJson);
    expect(editor.getDocument('json')).toEqual(reloadedJson);
    expect(normalizationResults).toEqual([false, false]);
    assertRowsContainOnlyCells(getRows(editor));
  });
});
