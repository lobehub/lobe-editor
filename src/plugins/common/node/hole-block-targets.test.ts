import {
  $createTableSelection,
  $isTableSelection,
  TableCellNode,
  TableNode,
  TableRowNode,
} from '@lexical/table';
import { $isCodeNode, CodeNode } from '@lexical/code-core';
import {
  $getSelection,
  $getRoot,
  $isRangeSelection,
  $isTextNode,
  $setSelection,
  $nodesOfType,
  CUT_COMMAND,
  KEY_ENTER_COMMAND,
  UNDO_COMMAND,
  type TextNode,
} from 'lexical';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import Editor, { moment } from '@/editor-kernel';
import { HeadlessEditor } from '@/headless';
import { $getAtomicHolePointContext } from '@/plugins/common/node/atomic-hole-selection';
import { $isHoleNode, $readHoleSelectionCoverage, HoleNode } from '@/plugins/common/node/hole';
import { CommonPlugin } from '@/plugins/common/plugin';
import { MarkdownPlugin } from '@/plugins/markdown';
import {
  $createCodeMirrorNode,
  CodeMirrorNode,
} from '@/plugins/codemirror-block/node/CodeMirrorNode';
import {
  INSERT_CODEMIRROR_COMMAND,
  SELECT_AFTER_CODEMIRROR_COMMAND,
  SELECT_BEFORE_CODEMIRROR_COMMAND,
} from '@/plugins/codemirror-block/command';
import { CodemirrorPlugin } from '@/plugins/codemirror-block/plugin';
import { CodeblockPlugin } from '@/plugins/codeblock/plugin';
import { INSERT_TABLE_COMMAND } from '@/plugins/table/command';
import { TablePlugin } from '@/plugins/table/plugin';
import type { IEditor } from '@/types';

class MockClipboardEvent extends Event {
  constructor(
    type: string,
    readonly clipboardData: DataTransfer,
  ) {
    super(type, { bubbles: true, cancelable: true });
  }
}

const createClipboard = (): DataTransfer => {
  const values = new Map<string, string>();
  return {
    clearData: (type?: string) => {
      if (type) values.delete(type);
      else values.clear();
    },
    files: [],
    getData: (type: string) => values.get(type) || '',
    setData: (type: string, value: string) => {
      values.set(type, value);
    },
    get types() {
      return [...values.keys()];
    },
  } as unknown as DataTransfer;
};

const flushClipboard = async (): Promise<void> => {
  await Promise.resolve();
  await new Promise((resolve) => setTimeout(resolve, 0));
};

const getHolePayload = <T>(editor: IEditor, type: string): T => {
  const payload = editor
    .getLexicalEditor()!
    .getEditorState()
    .read(() => {
      const hole = $nodesOfType(HoleNode).find((candidate) =>
        candidate.getContentChildren().some((child) => child.getType() === type),
      );
      return hole?.getContentChildren().find((child) => child.getType() === type) as T | undefined;
    });

  if (!payload) throw new Error(`Missing Hole payload: ${type}`);
  return payload;
};

const getRootTypes = (editor: IEditor): string[] =>
  editor
    .getLexicalEditor()!
    .getEditorState()
    .read(() =>
      $getRoot()
        .getChildren()
        .map((node) => node.getType()),
    );

describe('Hole block targets', () => {
  let editor: IEditor | undefined;
  let headless: HeadlessEditor | undefined;
  let root: HTMLDivElement | undefined;

  beforeEach(() => {
    Object.defineProperty(MockClipboardEvent, 'name', { value: 'ClipboardEvent' });
    vi.stubGlobal('ClipboardEvent', MockClipboardEvent);
    vi.stubGlobal(
      'ResizeObserver',
      class {
        observe() {}
        unobserve() {}
        disconnect() {}
      },
    );
  });

  afterEach(() => {
    editor?.destroy();
    headless?.destroy();
    editor = undefined;
    headless = undefined;
    root?.remove();
    root = undefined;
    vi.unstubAllGlobals();
  });

  it('wraps an ordinary CodeNode while preserving JSON and Markdown projections', async () => {
    editor = Editor.createEditor().registerPlugins([CommonPlugin, MarkdownPlugin, CodeblockPlugin]);
    editor.initHeadlessEditor();
    editor.setDocument('markdown', 'before\n\n```ts\nconst value = 1;\n```\n\nafter');
    await moment();

    const lexical = editor.getLexicalEditor()!;
    lexical.getEditorState().read(() => {
      const holes = $nodesOfType(HoleNode);
      expect(holes).toHaveLength(1);
      const code = holes[0]?.getContentChildren()[0];
      expect(code).toBeInstanceOf(CodeNode);
      expect($isCodeNode(code)).toBe(true);
    });

    const markdown = editor.getDocument('markdown') as unknown as string;
    const json = JSON.stringify(editor.getDocument('json'));
    expect(markdown).toContain('```typescript\nconst value = 1;\n```');
    expect(json).not.toContain('"type":"hole"');
  });

  it('keeps partial CodeNode selections inside the composite Hole', async () => {
    editor = Editor.createEditor().registerPlugins([CommonPlugin, MarkdownPlugin, CodeblockPlugin]);
    editor.initHeadlessEditor();
    editor.setDocument('markdown', '```ts\nconst value = 1;\n```');
    await moment();

    const lexical = editor.getLexicalEditor()!;
    let codeKey = '';
    lexical.update(() => {
      const code = getHolePayload<CodeNode>(editor!, 'code');
      codeKey = code.getKey();
      const firstText = code.getFirstDescendant<TextNode>();
      if (!firstText || !$isTextNode(firstText) || firstText.getType() !== 'code-highlight') {
        throw new Error('Code text payload missing');
      }
      firstText.select(0, 4);
    });
    await moment();

    lexical.getEditorState().read(() => {
      const hole = $nodesOfType(HoleNode)[0];
      const selection = $getSelection();
      if (!hole || !$isRangeSelection(selection)) throw new Error('Code selection missing');
      expect(hole.getContentChildren()[0]?.getKey()).toBe(codeKey);
      expect($readHoleSelectionCoverage(hole, selection).covered).toBe(false);
      expect($getAtomicHolePointContext(selection.anchor)).toBeNull();
    });

    expect(
      lexical.dispatchCommand(CUT_COMMAND, new MockClipboardEvent('cut', createClipboard())),
    ).toBe(true);
    await flushClipboard();
    expect(getRootTypes(editor)).toEqual(['hole']);
  });

  it('uses the CodeNode Hole boundary for Enter and restores it through Undo', async () => {
    editor = Editor.createEditor().registerPlugins([CommonPlugin, MarkdownPlugin, CodeblockPlugin]);
    editor.initHeadlessEditor();
    editor.setDocument('markdown', '```ts\nconst value = 1;\n```');
    await moment();

    const lexical = editor.getLexicalEditor()!;
    lexical.update(() => {
      const code = getHolePayload<CodeNode>(editor!, 'code');
      const hole = code.getParent();
      if (!$isHoleNode(hole)) throw new Error('Code Hole missing');
      const cursor = hole.getLastChild();
      if (!cursor || cursor.getType() !== 'cursor') throw new Error('Code boundary missing');
      cursor.selectStart();
    });
    await moment();

    const event = new KeyboardEvent('keydown', { cancelable: true, key: 'Enter' });
    expect(lexical.dispatchCommand(KEY_ENTER_COMMAND, event)).toBe(true);
    await moment();
    expect(getRootTypes(editor)).toEqual(['hole', 'paragraph']);

    expect(lexical.dispatchCommand(UNDO_COMMAND, undefined)).toBe(true);
    await moment();
    expect(getRootTypes(editor)).toEqual(['hole']);
    expect(editor.getDocument('markdown')).toContain('const value = 1;');
  });

  it('wraps the headless CodeMirror code target and keeps internal updates editable', async () => {
    headless = new HeadlessEditor();
    headless.hydrateMarkdown('```js\nconst answer = 41;\n```');
    await moment();

    const lexical = headless.kernel.getLexicalEditor()!;
    lexical.getEditorState().read(() => {
      const holes = $nodesOfType(HoleNode);
      expect(holes).toHaveLength(1);
      expect(holes[0]?.getContentChildren()[0]).toBeInstanceOf(CodeMirrorNode);
    });

    lexical.update(() => {
      const code = getHolePayload<CodeMirrorNode>(headless!.kernel, 'code');
      code.setCode('const answer = 42;');
    });
    await moment();

    expect(headless.export().markdown).toContain('const answer = 42;');
    expect(JSON.stringify(headless.export().editorData)).not.toContain('"type":"hole"');
  });

  it('resolves CodeMirror boundary commands through the Hole cursors', async () => {
    editor = Editor.createEditor().registerPlugins([
      CommonPlugin,
      MarkdownPlugin,
      // The headless default uses this same plugin for serialized `code` nodes.
      CodemirrorPlugin,
    ]);
    editor.initHeadlessEditor();
    editor.setDocument('markdown', '```js\nconst answer = 42;\n```');
    await moment();

    const lexical = editor.getLexicalEditor()!;
    const codeKey = getHolePayload<CodeMirrorNode>(editor, 'code').getKey();
    expect(lexical.dispatchCommand(SELECT_BEFORE_CODEMIRROR_COMMAND, { key: codeKey })).toBe(true);
    await moment();
    lexical.getEditorState().read(() => {
      const hole = $nodesOfType(HoleNode)[0];
      const selection = $getSelection();
      if (!hole || !$isRangeSelection(selection)) throw new Error('Before boundary missing');
      expect(selection.anchor.key).toBe(hole.getBeforeCursor()?.getKey());
    });

    expect(lexical.dispatchCommand(SELECT_AFTER_CODEMIRROR_COMMAND, { key: codeKey })).toBe(true);
    await moment();
    lexical.getEditorState().read(() => {
      const hole = $nodesOfType(HoleNode)[0];
      const selection = $getSelection();
      if (!hole || !$isRangeSelection(selection)) throw new Error('After boundary missing');
      expect(selection.anchor.key).toBe(hole.getAfterCursor()?.getKey());
    });
    expect(getRootTypes(editor)).toEqual(['hole']);
  });

  it('inserts a CodeMirror block beside a selected Hole boundary', async () => {
    editor = Editor.createEditor().registerPlugins([
      CommonPlugin,
      MarkdownPlugin,
      CodemirrorPlugin,
    ]);
    editor.initHeadlessEditor();
    editor.setDocument('markdown', '```js\nconst existing = true;\n```');
    await moment();

    const lexical = editor.getLexicalEditor()!;
    lexical.update(() => {
      const code = getHolePayload<CodeMirrorNode>(editor!, 'code');
      const hole = code.getParent();
      if (!$isHoleNode(hole)) throw new Error('Code Hole missing');
      hole.getAfterCursor()?.selectStart();
    });
    await moment();

    expect(lexical.dispatchCommand(INSERT_CODEMIRROR_COMMAND, undefined)).toBe(true);
    await moment();
    lexical.getEditorState().read(() => {
      const holes = $nodesOfType(HoleNode);
      expect(holes).toHaveLength(2);
      expect(holes.every((hole) => hole.getContentChildren().length === 1)).toBe(true);
      expect(holes.every((hole) => hole.getContentChildren()[0]?.getType() === 'code')).toBe(true);
    });
  });

  it('wraps a table while preserving cell editing and table selection semantics', async () => {
    editor = Editor.createEditor().registerPlugins([CommonPlugin, MarkdownPlugin, TablePlugin]);
    editor.initHeadlessEditor();
    editor.setDocument('markdown', '| Name | Status |\n| --- | --- |\n| Ada | Ready |');
    await moment();

    const lexical = editor.getLexicalEditor()!;
    let tableKey = '';
    lexical.update(() => {
      const table = getHolePayload<TableNode>(editor!, 'table');
      tableKey = table.getKey();
      const row = table.getFirstChild<TableRowNode>();
      const cell = row?.getFirstChild<TableCellNode>();
      const text = cell?.getFirstDescendant<TextNode>();
      if (!cell || !text || !$isTextNode(text)) throw new Error('Table cell text missing');
      text.select(0, 2);
    });
    await moment();

    lexical.getEditorState().read(() => {
      const hole = $nodesOfType(HoleNode)[0];
      const selection = $getSelection();
      if (!hole || !$isRangeSelection(selection)) throw new Error('Table selection missing');
      expect(hole.getContentChildren()[0]?.getKey()).toBe(tableKey);
      expect($readHoleSelectionCoverage(hole, selection).covered).toBe(false);
      expect($getAtomicHolePointContext(selection.anchor)).toBeNull();
    });

    expect(
      lexical.dispatchCommand(CUT_COMMAND, new MockClipboardEvent('cut', createClipboard())),
    ).toBe(true);
    await flushClipboard();
    expect(getRootTypes(editor)).toEqual(['hole']);

    lexical.update(() => {
      const table = getHolePayload<TableNode>(editor!, 'table');
      const row = table.getFirstChild<TableRowNode>();
      const cell = row?.getFirstChild<TableCellNode>();
      const text = cell?.getFirstDescendant<TextNode>();
      if (!cell || !text || !$isTextNode(text)) throw new Error('Table cell text missing');
      text.setTextContent('Grace');

      const lastRow = table.getLastChild<TableRowNode>();
      const firstCell = row?.getFirstChild<TableCellNode>();
      const lastCell = lastRow?.getLastChild<TableCellNode>();
      if (
        !firstCell ||
        !lastCell ||
        !(firstCell instanceof TableCellNode) ||
        !(lastCell instanceof TableCellNode)
      ) {
        throw new Error('Table selection cells missing');
      }
      const tableSelection = $createTableSelection();
      tableSelection.set(table.getKey(), firstCell.getKey(), lastCell.getKey());
      $setSelection(tableSelection);
    });
    await moment();

    lexical.getEditorState().read(() => {
      const selection = $getSelection();
      expect($isTableSelection(selection)).toBe(true);
      expect($nodesOfType(HoleNode)).toHaveLength(1);
    });
    expect(editor.getDocument('markdown')).toContain('Grace');
  });

  it('inserts a table beside a selected Table Hole boundary', async () => {
    editor = Editor.createEditor().registerPlugins([CommonPlugin, MarkdownPlugin, TablePlugin]);
    root = document.createElement('div');
    root.contentEditable = 'true';
    document.body.append(root);
    editor.setRootElement(root);
    editor.setDocument('markdown', '| Name |\n| --- |\n| Ada |');
    await moment();

    const lexical = editor.getLexicalEditor()!;
    lexical.update(() => {
      const table = getHolePayload<TableNode>(editor!, 'table');
      const hole = table.getParent();
      if (!$isHoleNode(hole)) throw new Error('Table Hole missing');
      hole.getAfterCursor()?.selectStart();
    });
    await moment();

    expect(
      lexical.dispatchCommand(INSERT_TABLE_COMMAND, {
        columns: '1',
        rows: '1',
      }),
    ).toBe(true);
    await moment();
    lexical.getEditorState().read(() => {
      const holes = $nodesOfType(HoleNode);
      expect(holes).toHaveLength(2);
      expect(holes.every((hole) => hole.getContentChildren().length === 1)).toBe(true);
      expect(holes.every((hole) => hole.getContentChildren()[0]?.getType() === 'table')).toBe(true);
    });

    lexical.update(() => {
      const table = getHolePayload<TableNode>(editor!, 'table');
      const cell = table.getFirstChild<TableRowNode>()?.getFirstChild<TableCellNode>();
      if (!cell) throw new Error('Nested table guard cell missing');
      cell.clear();
      cell.append($createCodeMirrorNode('javascript', 'nested code'));
    });
    await moment();
    lexical.update(() => {
      const nestedHole = $nodesOfType(HoleNode).find(
        (hole) =>
          hole.getParent()?.getType() === 'tablecell' &&
          hole.getContentChildren()[0] instanceof CodeMirrorNode,
      );
      if (!nestedHole) throw new Error('Nested CodeMirror Hole missing');
      nestedHole.getAfterCursor()?.selectStart();
    });
    await moment();
    const beforeNestedInsert = getRootTypes(editor);
    const beforeNestedInsertJSON = JSON.stringify(editor.getDocument('json'));
    expect(
      lexical.dispatchCommand(INSERT_TABLE_COMMAND, {
        columns: '1',
        rows: '1',
      }),
    ).toBe(false);
    await moment();
    expect(getRootTypes(editor)).toEqual(beforeNestedInsert);
    expect(JSON.stringify(editor.getDocument('json'))).toBe(beforeNestedInsertJSON);
  });
});
