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

const source = `<?xml version="1.0" encoding="UTF-8"?><root><table id="ll63" colWidths="200,200,200"><tr id="lqqe"><td id="lwap"><p>Apple old line 1</p><p>Apple old line 2</p></td><td id="mo48"><p>10</p></td><td id="n4t5"><p>Old note</p></td></tr></table></root>`;

const getRoot = (editor: IEditor): any => (editor.getDocument('json') as any).root;
const getCells = (editor: IEditor): any[] => getRoot(editor).children[0].children[0].children;
const getText = (node: any): string =>
  typeof node?.text === 'string'
    ? node.text
    : Array.isArray(node?.children)
      ? node.children.map(getText).join('\n')
      : '';

describe('LiteXML table cell modify diffs', () => {
  let editor: IEditor;

  beforeEach(() => {
    resetRandomKey();
    editor = Editor.createEditor();
    editor.registerPlugins([LitexmlPlugin, MarkdownPlugin, CommonPlugin, TablePlugin]);
    editor.initNodeEditor();
    editor.setDocument('litexml', source);
  });

  const modify = async (litexml: string | string[]) => {
    editor.dispatchCommand(LITEXML_MODIFY_COMMAND, [{ action: 'modify', litexml }]);
    await moment();
  };

  it('keeps the table, row and cell structure when modifying a td', async () => {
    await modify('<td id="mo48"><p>20</p></td>');

    const root = getRoot(editor);
    const cells = getCells(editor);
    expect(root.children.filter((child: any) => child.type === 'table')).toHaveLength(1);
    expect(root.children[0].type).toBe('table');
    expect(root.children[0].children).toHaveLength(1);
    expect(root.children[0].children[0].type).toBe('tablerow');
    expect(cells).toHaveLength(3);
    expect(cells.every((cell) => cell.type === 'tablecell')).toBe(true);
    expect(cells[1].children[0]).toMatchObject({ diffType: 'modify', type: 'diff' });
  });

  it('represents multiple old lines changing into one new line in one diff', async () => {
    await modify('<td id="lwap"><p>Orange</p></td>');

    const diff = getCells(editor)[0].children[0];
    expect(diff.children).toHaveLength(2);
    expect(diff.children[0]).toMatchObject({ side: 'before', type: 'diff-content' });
    expect(diff.children[0].children).toHaveLength(2);
    expect(diff.children[1]).toMatchObject({ side: 'after', type: 'diff-content' });
    expect(diff.children[1].children).toHaveLength(1);
    expect(getText(diff.children[0])).toContain('Apple old line 1');
    expect(getText(diff.children[1])).toContain('Orange');
  });

  it('represents one old line changing into multiple new lines in one diff', async () => {
    await modify('<td id="mo48"><p>20</p><p>units</p><p>confirmed</p></td>');

    const diff = getCells(editor)[1].children[0];
    expect(diff.children[0].children).toHaveLength(1);
    expect(diff.children[1].children).toHaveLength(3);
    expect(getText(diff.children[1])).toContain('confirmed');
  });

  it('supports multiple old lines changing into multiple new lines', async () => {
    await modify('<td id="lwap"><p>Orange line 1</p><p>Orange line 2</p><p>Orange line 3</p></td>');

    const diff = getCells(editor)[0].children[0];
    expect(diff.children[0].children).toHaveLength(2);
    expect(diff.children[1].children).toHaveLength(3);
  });

  it('preserves a grouped multi-line diff across JSON reloads', async () => {
    await modify('<td id="lwap"><p>Orange line 1</p><p>Orange line 2</p></td>');
    const json = editor.getDocument('json');

    editor.setDocument('json', json, { keepId: true });
    await moment();

    const diff = getCells(editor)[0].children[0];
    expect(diff).toMatchObject({ diffType: 'modify', type: 'diff' });
    expect(diff.children.map((child: any) => child.side)).toEqual(['before', 'after']);
    expect(diff.children[0].children).toHaveLength(2);
    expect(diff.children[1].children).toHaveLength(2);
  });

  it('keeps td structural attributes unchanged while staging its content modification', async () => {
    await modify(
      '<td id="lwap" backgroundColor="#ff0000" colSpan="2" rowSpan="2"><p>Orange</p></td>',
    );

    const cell = getCells(editor)[0];
    expect(cell).toMatchObject({ backgroundColor: null, colSpan: 1, rowSpan: 1 });
    expect(cell.children[0]).toMatchObject({ diffType: 'modify', type: 'diff' });
  });

  it('accepts a grouped cell diff by unwrapping all new lines inside the td', async () => {
    await modify('<td id="lwap"><p>Orange line 1</p><p>Orange line 2</p></td>');
    editor.dispatchCommand(LITEXML_DIFFNODE_ALL_COMMAND, { action: DiffAction.Accept });
    await moment();

    const cell = getCells(editor)[0];
    expect(cell.children).toHaveLength(2);
    expect(cell.children.every((child: any) => child.type === 'paragraph')).toBe(true);
    expect(getText(cell)).toContain('Orange line 1');
    expect(JSON.stringify(cell)).not.toContain('diff-content');
  });

  it('rejects a grouped cell diff by restoring all original lines', async () => {
    await modify('<td id="lwap"><p>Orange</p></td>');
    editor.dispatchCommand(LITEXML_DIFFNODE_ALL_COMMAND, { action: DiffAction.Reject });
    await moment();

    const cell = getCells(editor)[0];
    expect(cell.children).toHaveLength(2);
    expect(getText(cell)).toContain('Apple old line 1');
    expect(getText(cell)).toContain('Apple old line 2');
    expect(getText(cell)).not.toContain('Orange');
  });

  it('keeps three td modifications in one row and accepts them together', async () => {
    await modify([
      '<td id="lwap"><p>Orange</p></td>',
      '<td id="mo48"><p>20</p></td>',
      '<td id="n4t5"><p>Added</p></td>',
    ]);

    expect(getCells(editor).map((cell) => cell.children[0].type)).toEqual(['diff', 'diff', 'diff']);

    editor.dispatchCommand(LITEXML_DIFFNODE_ALL_COMMAND, { action: DiffAction.Accept });
    await moment();

    const cells = getCells(editor);
    expect(cells).toHaveLength(3);
    expect(cells.map(getText)).toEqual(['Orange', '20', 'Added']);
    expect(getRoot(editor).children.filter((child: any) => child.type === 'table')).toHaveLength(1);
  });

  it('exports the proposed multi-line result while approval is pending', async () => {
    await modify('<td id="lwap"><p>Orange line 1</p><p>Orange line 2</p></td>');

    const litexml = editor.getDocument('litexml') as unknown as string;
    expect(litexml).toContain('Orange line 1');
    expect(litexml).toContain('Orange line 2');
    expect(litexml).not.toContain('Apple old line 1');
  });
});
