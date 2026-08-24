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
import { TablePlugin } from '@/plugins/table';
import type { IEditor } from '@/types';

const source =
  '<?xml version="1.0" encoding="UTF-8"?><root><p id="para">Original paragraph</p><table id="table" colWidths="200,200"><tr id="row"><td id="lwap"><p>Apple</p></td><td id="mo48"><p>10</p></td></tr></table><p id="sibling">Sibling</p></root>';

const json = (editor: IEditor): any => editor.getDocument('json') as any;

const idFor = (editor: IEditor, tag: string, text: string): string => {
  const xml = editor.getDocument('litexml') as unknown as string;
  const pattern = new RegExp(`<${tag} id="([^"]+)"[^>]*>[\\s\\S]*?</${tag}>`, 'g');
  const match = [...xml.matchAll(pattern)].find((candidate) => candidate[0].includes(text));
  if (!match) throw new Error(`Could not find ${tag} containing ${text}: ${xml}`);
  return match[1];
};

const tableId = (editor: IEditor): string => {
  const xml = editor.getDocument('litexml') as unknown as string;
  const match = /<table id="([^"]+)"/.exec(xml);
  if (!match) throw new Error(`Could not find table: ${xml}`);
  return match[1];
};

const collectTypes = (node: any, types: string[] = []): string[] => {
  if (node?.type) types.push(node.type);
  node?.children?.forEach((child: any) => collectTypes(child, types));
  return types;
};

describe('operation nested diff behavior', () => {
  let editor: IEditor;

  beforeEach(() => {
    resetRandomKey();
    editor = Editor.createEditor();
    editor.registerPlugins([LitexmlPlugin, MarkdownPlugin, CommonPlugin, TablePlugin]);
    editor.initNodeEditor();
    editor.setDocument('litexml', source);
  });

  it('allows first and second paragraph modifications without nested diff nodes', async () => {
    const firstId = idFor(editor, 'p', 'Original paragraph');
    editor.dispatchCommand(LITEXML_MODIFY_COMMAND, [
      { action: 'modify', litexml: `<p id="${firstId}">First</p>` },
    ]);
    await moment();
    const secondId = idFor(editor, 'p', 'First');
    editor.dispatchCommand(LITEXML_MODIFY_COMMAND, [
      { action: 'modify', litexml: `<p id="${secondId}">Second</p>` },
    ]);
    await moment();

    const tree = JSON.stringify(json(editor));
    expect(tree).toContain('Second');
    expect(tree).not.toContain('FirstFirst');
  });

  it('keeps a safe td remove when a table modify would nest a diff', async () => {
    const cellId = idFor(editor, 'td', 'Apple');
    const currentTableId = tableId(editor);
    editor.dispatchCommand(LITEXML_MODIFY_COMMAND, [
      { action: 'remove', id: cellId },
      {
        action: 'modify',
        litexml: `<table id="${currentTableId}"><tr><td><p>Changed</p></td><td><p>20</p></td></tr></table>`,
      },
    ]);
    await moment();

    const tree = JSON.stringify(json(editor));
    const types = collectTypes(json(editor).root);
    expect(types.filter((type) => type === 'table-cell-diff')).toHaveLength(1);
    expect(types.filter((type) => type === 'diff')).toHaveLength(1);
    expect(types.filter((type) => type === 'table')).toHaveLength(1);
    expect(tree).not.toContain('Changed');
  });

  it('updates a table cell diff after branch without adding an approval layer', async () => {
    const cellId = idFor(editor, 'td', 'Apple');
    editor.dispatchCommand(LITEXML_MODIFY_COMMAND, [
      { action: 'modify', litexml: `<td id="${cellId}"><p>Orange</p></td>` },
    ]);
    await moment();
    const afterId = idFor(editor, 'td', 'Orange');
    editor.dispatchCommand(LITEXML_MODIFY_COMMAND, [
      { action: 'modify', litexml: `<td id="${afterId}"><p>Red</p></td>` },
    ]);
    await moment();

    expect(JSON.stringify(json(editor))).toContain('Red');
    expect(collectTypes(json(editor).root).filter((type) => type === 'diff')).toHaveLength(1);
  });

  it('keeps detection consistent after JSON reload', async () => {
    const cellId = idFor(editor, 'td', 'Apple');
    editor.dispatchCommand(LITEXML_MODIFY_COMMAND, [{ action: 'remove', id: cellId }]);
    await moment();
    editor.setDocument('json', editor.getDocument('json'), { keepId: true });
    await moment();

    editor.dispatchCommand(LITEXML_MODIFY_COMMAND, [
      {
        action: 'modify',
        litexml: `<table id="${tableId(editor)}"><tr><td><p>Changed</p></td><td><p>20</p></td></tr></table>`,
      },
    ]);
    await moment();

    const tree = JSON.stringify(json(editor));
    const types = collectTypes(json(editor).root);
    expect(types.filter((type) => type === 'table-cell-diff')).toHaveLength(1);
    expect(types.filter((type) => type === 'diff')).toHaveLength(1);
    expect(tree).not.toContain('Changed');
  });

  it('rejects a row diff that would contain an existing cell approval', async () => {
    const cellId = idFor(editor, 'td', 'Apple');
    editor.dispatchCommand(LITEXML_MODIFY_COMMAND, [{ action: 'remove', id: cellId }]);
    await moment();
    const rowId = idFor(editor, 'tr', '10');
    editor.dispatchCommand(LITEXML_MODIFY_COMMAND, [
      {
        action: 'modify',
        litexml: `<tr id="${rowId}"><td><p>Changed</p></td><td><p>20</p></td></tr>`,
      },
    ]);
    await moment();

    const tree = JSON.stringify(json(editor));
    const types = collectTypes(json(editor).root);
    expect(types.filter((type) => type === 'table-cell-diff')).toHaveLength(1);
    expect(types.filter((type) => type === 'table-row-diff')).toHaveLength(0);
    expect(tree).not.toContain('Changed');
  });

  it('allows independent sibling modifications in one batch', async () => {
    editor.dispatchCommand(LITEXML_MODIFY_COMMAND, [
      {
        action: 'modify',
        litexml: `<p id="${idFor(editor, 'p', 'Original paragraph')}">First</p>`,
      },
      { action: 'modify', litexml: `<p id="${idFor(editor, 'p', 'Sibling')}">Second</p>` },
    ]);
    await moment();
    expect(JSON.stringify(json(editor))).toContain('First');
    expect(JSON.stringify(json(editor))).toContain('Second');
  });

  it('clears staged diffs through accept and reject', async () => {
    editor.dispatchCommand(LITEXML_MODIFY_COMMAND, [
      {
        action: 'modify',
        litexml: `<p id="${idFor(editor, 'p', 'Original paragraph')}">Accepted</p>`,
      },
      { action: 'modify', litexml: `<p id="${idFor(editor, 'p', 'Sibling')}">Rejected</p>` },
    ]);
    await moment();
    editor.dispatchCommand(LITEXML_DIFFNODE_ALL_COMMAND, { action: DiffAction.Accept });
    await moment();
    expect(JSON.stringify(json(editor))).not.toContain('diff');

    editor.dispatchCommand(LITEXML_MODIFY_COMMAND, [
      { action: 'modify', litexml: `<p id="${idFor(editor, 'p', 'Accepted')}">Rejected again</p>` },
    ]);
    await moment();
    editor.dispatchCommand(LITEXML_DIFFNODE_ALL_COMMAND, { action: DiffAction.Reject });
    await moment();
    expect(JSON.stringify(json(editor))).not.toContain('diff');
  });
});
