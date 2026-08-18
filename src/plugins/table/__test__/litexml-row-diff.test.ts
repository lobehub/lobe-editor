import { $isTableNode } from '@lexical/table';
import { $getRoot, $nodesOfType } from 'lexical';
import { beforeEach, describe, expect, it } from 'vitest';

import Editor, { moment, resetRandomKey } from '@/editor-kernel';
import { CommonPlugin } from '@/plugins/common';
import {
  DiffAction,
  LITEXML_DIFFNODE_ALL_COMMAND,
  LITEXML_DIFFNODE_COMMAND,
  LITEXML_MODIFY_COMMAND,
  LitexmlPlugin,
} from '@/plugins/litexml';
import { TableRowDiffNode } from '@/plugins/litexml/node/TableRowDiffNode';
import { MarkdownPlugin } from '@/plugins/markdown';
import type { IEditor } from '@/types';

import { TablePlugin } from '../plugin';

const initialTable = `
<table>
  <tr><td>Name</td><td>Quantity</td><td>Note</td></tr>
  <tr><td>Apple</td><td>10</td><td>Test data</td></tr>
  <tr><td>Banana</td><td>5</td><td>Example note</td></tr>
</table>`;

const getRowIdByText = (xml: string, text: string): string => {
  const rows = xml.matchAll(/<tr id="([^"]+)"[^>]*>([\s\S]*?)<\/tr>/g);
  for (const match of rows) {
    if (match[2].includes(text)) return match[1];
  }
  throw new Error(`Row containing ${text} was not found.`);
};

describe('table LiteXML row diffs', () => {
  let editor: IEditor;

  beforeEach(() => {
    resetRandomKey();
    editor = Editor.createEditor();
    editor.registerPlugins([LitexmlPlugin, MarkdownPlugin, CommonPlugin, TablePlugin]);
    editor.initNodeEditor();
    editor.setDocument('litexml', initialTable);
  });

  const modifyAppleRow = async () => {
    const before = editor.getDocument('litexml') as unknown as string;
    const rowId = getRowIdByText(before, 'Apple');
    editor.dispatchCommand(LITEXML_MODIFY_COMMAND, [
      {
        action: 'modify',
        litexml: `<tr id="${rowId}"><td>Orange</td><td>12</td><td>Updated</td></tr>`,
      },
    ]);
    await moment();
  };

  it('keeps a row modification inside one valid table as a paired remove/add diff', async () => {
    await modifyAppleRow();

    const lexicalEditor = editor.getLexicalEditor()!;
    const snapshot = lexicalEditor.getEditorState().read(() => {
      const table = $getRoot().getFirstChild();
      expect($isTableNode(table)).toBe(true);
      const rows = $isTableNode(table) ? table.getChildren() : [];
      const diffs = $nodesOfType(TableRowDiffNode);
      return {
        changeIds: diffs.map((row) => row.getChangeId()),
        diffTypes: diffs.map((row) => row.getDiffType()),
        rowTypes: rows.map((row) => row.getType()),
      };
    });

    expect(snapshot.rowTypes).toEqual(['tablerow', 'table-row-diff', 'table-row-diff', 'tablerow']);
    expect(snapshot.diffTypes).toEqual(['remove', 'add']);
    expect(snapshot.changeIds[0]).toBeTruthy();
    expect(snapshot.changeIds[0]).toBe(snapshot.changeIds[1]);

    const projectedXML = editor.getDocument('litexml') as unknown as string;
    const projectedMarkdown = editor.getDocument('markdown') as unknown as string;
    expect(projectedXML.match(/<table/g)).toHaveLength(1);
    expect(projectedXML.match(/<tr/g)).toHaveLength(3);
    expect(projectedXML).toContain('Orange');
    expect(projectedXML).not.toContain('Apple');
    expect(projectedMarkdown).toContain('Orange');
    expect(projectedMarkdown).not.toContain('Apple');
  });

  it('accepts and rejects a paired row modification from either row key', async () => {
    await modifyAppleRow();
    const lexicalEditor = editor.getLexicalEditor()!;
    const addKey = lexicalEditor.getEditorState().read(() =>
      $nodesOfType(TableRowDiffNode)
        .find((row) => row.getDiffType() === 'add')!
        .getKey(),
    );
    editor.dispatchCommand(LITEXML_DIFFNODE_COMMAND, {
      action: DiffAction.Accept,
      nodeKey: addKey,
    });
    await moment();

    expect(editor.getDocument('markdown') as unknown as string).toContain('Orange');
    expect(lexicalEditor.getEditorState().read(() => $nodesOfType(TableRowDiffNode))).toHaveLength(
      0,
    );

    editor.setDocument('litexml', initialTable);
    await modifyAppleRow();
    const removeKey = lexicalEditor.getEditorState().read(() =>
      $nodesOfType(TableRowDiffNode)
        .find((row) => row.getDiffType() === 'remove')!
        .getKey(),
    );
    editor.dispatchCommand(LITEXML_DIFFNODE_COMMAND, {
      action: DiffAction.Reject,
      nodeKey: removeKey,
    });
    await moment();

    const rejectedMarkdown = editor.getDocument('markdown') as unknown as string;
    expect(rejectedMarkdown).toContain('Apple');
    expect(rejectedMarkdown).not.toContain('Orange');
  });

  it('rejects incompatible row structures without changing the table', async () => {
    const before = editor.getDocument('litexml') as unknown as string;
    const rowId = getRowIdByText(before, 'Apple');
    editor.dispatchCommand(LITEXML_MODIFY_COMMAND, [
      {
        action: 'modify',
        litexml: `<tr id="${rowId}"><td>Orange</td><td>12</td></tr>`,
      },
    ]);
    await moment();

    expect(editor.getDocument('markdown') as unknown as string).toContain('Apple');
    expect(
      editor
        .getLexicalEditor()!
        .getEditorState()
        .read(() => $nodesOfType(TableRowDiffNode)),
    ).toHaveLength(0);
  });

  it('falls incomplete modify pairs back to standalone add/remove rows', async () => {
    await modifyAppleRow();
    const lexicalEditor = editor.getLexicalEditor()!;
    lexicalEditor.update(() => {
      const add = $nodesOfType(TableRowDiffNode).find((row) => row.getDiffType() === 'add');
      add?.remove();
    });
    await moment();
    await Promise.resolve();

    const remaining = lexicalEditor.getEditorState().read(() => {
      const row = $nodesOfType(TableRowDiffNode)[0];
      return { changeId: row.getChangeId(), diffType: row.getDiffType(), key: row.getKey() };
    });
    expect(remaining).toMatchObject({ changeId: undefined, diffType: 'remove' });

    editor.dispatchCommand(LITEXML_DIFFNODE_COMMAND, {
      action: DiffAction.Reject,
      nodeKey: remaining.key,
    });
    await moment();
    expect(editor.getDocument('markdown') as unknown as string).toContain('Apple');
  });

  it('falls reversed modify pairs back to independent rows', async () => {
    await modifyAppleRow();
    const lexicalEditor = editor.getLexicalEditor()!;
    lexicalEditor.update(() => {
      const rows = $nodesOfType(TableRowDiffNode);
      const remove = rows.find((row) => row.getDiffType() === 'remove')!;
      const add = rows.find((row) => row.getDiffType() === 'add')!;
      add.insertAfter(remove);
    });
    await moment();
    await Promise.resolve();

    const changeIds = lexicalEditor
      .getEditorState()
      .read(() => $nodesOfType(TableRowDiffNode).map((row) => row.getChangeId()));
    expect(changeIds).toEqual([undefined, undefined]);
  });

  it('represents row insertions and removals as standalone diff rows', async () => {
    const before = editor.getDocument('litexml') as unknown as string;
    const appleId = getRowIdByText(before, 'Apple');
    editor.dispatchCommand(LITEXML_MODIFY_COMMAND, [
      {
        action: 'insert',
        afterId: appleId,
        litexml: '<tr><td>Pear</td><td>7</td><td>Inserted</td></tr>',
      },
    ]);
    await moment();

    let diffRows = editor
      .getLexicalEditor()!
      .getEditorState()
      .read(() => $nodesOfType(TableRowDiffNode).map((row) => row.getDiffType()));
    expect(diffRows).toEqual(['add']);
    expect(editor.getDocument('markdown') as unknown as string).toContain('Pear');

    editor.dispatchCommand(LITEXML_DIFFNODE_ALL_COMMAND, { action: DiffAction.Reject });
    await moment();
    expect(editor.getDocument('markdown') as unknown as string).not.toContain('Pear');

    const refreshedXML = editor.getDocument('litexml') as unknown as string;
    const refreshedAppleId = getRowIdByText(refreshedXML, 'Apple');
    editor.dispatchCommand(LITEXML_MODIFY_COMMAND, [{ action: 'remove', id: refreshedAppleId }]);
    await moment();

    diffRows = editor
      .getLexicalEditor()!
      .getEditorState()
      .read(() => $nodesOfType(TableRowDiffNode).map((row) => row.getDiffType()));
    expect(diffRows).toEqual(['remove']);
    expect(editor.getDocument('markdown') as unknown as string).not.toContain('Apple');

    editor.dispatchCommand(LITEXML_DIFFNODE_ALL_COMMAND, { action: DiffAction.Reject });
    await moment();
    expect(editor.getDocument('markdown') as unknown as string).toContain('Apple');
  });

  it('accepts all row modifications once per changeId', async () => {
    await modifyAppleRow();
    editor.dispatchCommand(LITEXML_DIFFNODE_ALL_COMMAND, { action: DiffAction.Accept });
    await moment();

    const markdown = editor.getDocument('markdown') as unknown as string;
    expect(markdown).toContain('Orange');
    expect(markdown).not.toContain('Apple');
    expect(
      editor
        .getLexicalEditor()!
        .getEditorState()
        .read(() => $nodesOfType(TableRowDiffNode)),
    ).toHaveLength(0);
  });
});
