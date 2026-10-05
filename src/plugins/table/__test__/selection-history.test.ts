import {
  $computeTableMapSkipCellCheck,
  $createTableNodeWithDimensions,
  $createTableSelection,
  $getTableCellNodeFromLexicalNode,
  $isTableNode,
  $isTableSelection,
  getTableObserverFromTableElement,
  type TableCellNode,
  type TableNode,
  type TableRowNode,
} from '@lexical/table';
import type { Provider, ProviderAwareness, UserState } from '@lexical/yjs';
import {
  $createParagraphNode,
  $createTextNode,
  $getNodeByKey,
  $getRoot,
  $getSelection,
  $isElementNode,
  $isRangeSelection,
  $setSelection,
  CONTROLLED_TEXT_INSERTION_COMMAND,
  KEY_ARROW_RIGHT_COMMAND,
  REDO_COMMAND,
  UNDO_COMMAND,
} from 'lexical';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { Doc } from 'yjs';

import Editor, { moment } from '@/editor-kernel';
import { CommonPlugin } from '@/plugins/common';
import { YjsPlugin } from '@/plugins/yjs/plugin';

import { INSERT_TABLE_COLUMN_COMMAND } from '../command';
import { TablePlugin } from '../plugin';

class TestProvider implements Provider {
  readonly awareness: ProviderAwareness = {
    getLocalState: () => null,
    getStates: () => new Map<number, UserState>(),
    off: (type, listener) => this.listeners.get(type)?.delete(listener as never),
    on: (type, listener) => {
      const callbacks = this.listeners.get(type) ?? new Set();
      callbacks.add(listener as never);
      this.listeners.set(type, callbacks);
    },
    setLocalState: () => undefined,
    setLocalStateField: () => undefined,
  };

  private readonly listeners = new Map<string, Set<(...args: never[]) => void>>();

  connect(): void {
    this.listeners.get('status')?.forEach((listener) => {
      listener({ status: 'connected' } as never);
    });
    queueMicrotask(() => {
      this.listeners.get('sync')?.forEach((listener) => listener(true as never));
    });
  }

  disconnect(): void {}

  off(type: string, listener: unknown): void {
    this.listeners.get(type)?.delete(listener as never);
  }

  on(type: string, listener: unknown): void {
    const callbacks = this.listeners.get(type) ?? new Set();
    callbacks.add(listener as never);
    this.listeners.set(type, callbacks);
  }
}

describe('table selection history repair', () => {
  let kernel: ReturnType<typeof Editor.createEditor> | undefined;
  let root: HTMLDivElement | undefined;
  let doc: Doc | undefined;

  beforeEach(() => {
    class TestResizeObserver {
      observe(): void {}
      disconnect(): void {}
    }
    globalThis.ResizeObserver = TestResizeObserver as unknown as typeof ResizeObserver;
  });

  afterEach(() => {
    kernel?.destroy();
    root?.remove();
    doc?.destroy();
    kernel = undefined;
    root = undefined;
    doc = undefined;
  });

  const pauseHistoryCapture = () => new Promise((resolve) => setTimeout(resolve, 650));

  const expectTableDOM = (
    editor: ReturnType<typeof Editor.createEditor>,
    key: string,
    count: number,
  ) => {
    const host = editor.getLexicalEditor()?.getElementByKey(key);
    const table = host?.querySelector<HTMLTableElement>(':scope table');
    expect(table).not.toBeNull();
    if (!table) return;

    const columns = Array.from(table.querySelectorAll<HTMLElement>(':scope > colgroup > col'));
    expect(columns).toHaveLength(count);
    expect(columns.map((column) => column.style.width)).toEqual(
      Array.from({ length: count }, () => '250px'),
    );
    const rows = Array.from(table.querySelectorAll('tr'));
    expect(rows).toHaveLength(2);
    rows.forEach((row) => {
      expect(row.querySelectorAll(':scope > td, :scope > th')).toHaveLength(count);
    });
  };

  it('repairs the surviving cell after two Yjs undos and keeps redo stable', async () => {
    kernel = Editor.createEditor().registerPlugins([CommonPlugin, TablePlugin]);
    root = document.createElement('div');
    root.contentEditable = 'true';
    document.body.append(root);
    const lexical = kernel.setRootElement(root);
    root.focus();

    doc = new Doc();
    const provider = new TestProvider();
    kernel.registerPlugins([
      [
        YjsPlugin,
        {
          id: 'table-selection-history',
          providerFactory: () => provider,
          shouldBootstrap: true,
          yjsDoc: doc,
        },
      ],
    ]);
    kernel.setDocument('text', '');
    await moment();
    await moment();
    root.focus();

    let tableKey = '';
    lexical.update(() => {
      const table = $createTableNodeWithDimensions(2, 2, false);
      tableKey = table.getKey();
      table.setColWidths([250, 250]);
      table.getChildren().forEach((row, rowIndex) => {
        (row as TableRowNode).getChildren().forEach((cell, columnIndex) => {
          const cellNode = cell as TableCellNode;
          const paragraph = cellNode.getFirstChild();
          if ($isElementNode(paragraph)) {
            paragraph.append($createTextNode(`T${rowIndex + 1}${columnIndex + 1}`));
          } else {
            cellNode.append(
              $createParagraphNode().append($createTextNode(`T${rowIndex + 1}${columnIndex + 1}`)),
            );
          }
        });
      });
      $getRoot().append(table);
    });
    await moment();
    await moment();
    await pauseHistoryCapture();

    expect(
      lexical.dispatchCommand(INSERT_TABLE_COLUMN_COMMAND, {
        columnIndex: 1,
        insertAfter: true,
        table: tableKey,
      }),
    ).toBe(true);
    await moment();
    await pauseHistoryCapture();
    expect(
      lexical.dispatchCommand(INSERT_TABLE_COLUMN_COMMAND, {
        columnIndex: 2,
        insertAfter: true,
        table: tableKey,
      }),
    ).toBe(true);
    await moment();

    let survivingAnchorKey = '';
    let removedFocusKey = '';
    lexical.update(() => {
      const table = $getNodeByKey<TableNode>(tableKey);
      if (!$isTableNode(table)) throw new Error('Table missing');
      const [tableMap] = $computeTableMapSkipCellCheck(table, null, null);
      const anchor = tableMap[1][1].cell;
      const focus = tableMap[1][3].cell;
      survivingAnchorKey = anchor.getKey();
      removedFocusKey = focus.getKey();
      const selection = $createTableSelection();
      selection.set(tableKey, survivingAnchorKey, removedFocusKey);
      $setSelection(selection);

      const tableElement = lexical.getElementByKey(tableKey)?.querySelector('table');
      const observer = tableElement ? getTableObserverFromTableElement(tableElement) : null;
      observer?.$updateTableTableSelection(selection);
    });
    await moment();

    lexical.dispatchCommand(UNDO_COMMAND, undefined);
    await moment();
    await moment();
    lexical.dispatchCommand(UNDO_COMMAND, undefined);
    await moment();
    await moment();

    lexical.getEditorState().read(() => {
      const table = $getNodeByKey<TableNode>(tableKey);
      const selection = $getSelection();
      expect(table?.getColumnCount()).toBe(2);
      expect($isTableSelection(selection)).toBe(false);
      expect($isRangeSelection(selection)).toBe(true);
      if ($isRangeSelection(selection)) {
        expect($getTableCellNodeFromLexicalNode(selection.anchor.getNode())?.getKey()).toBe(
          survivingAnchorKey,
        );
        expect($getNodeByKey(removedFocusKey)).toBeNull();
      }
    });
    expectTableDOM(kernel, tableKey, 2);

    lexical.dispatchCommand(REDO_COMMAND, undefined);
    await moment();
    await moment();
    lexical.dispatchCommand(REDO_COMMAND, undefined);
    await moment();
    await moment();
    lexical.getEditorState().read(() => {
      const table = $getNodeByKey<TableNode>(tableKey);
      expect(table?.getColumnCount()).toBe(4);
      expect($isTableSelection($getSelection())).toBe(false);
    });
    expectTableDOM(kernel, tableKey, 4);

    lexical.dispatchCommand(UNDO_COMMAND, undefined);
    await moment();
    await moment();
    lexical.dispatchCommand(UNDO_COMMAND, undefined);
    lexical.dispatchCommand(
      KEY_ARROW_RIGHT_COMMAND,
      new KeyboardEvent('keydown', { key: 'ArrowRight' }),
    );
    lexical.dispatchCommand(CONTROLLED_TEXT_INSERTION_COMMAND, 'x');
    await moment();
    await moment();
    await moment();
    expect(
      lexical.getEditorState().read(() => $getNodeByKey<TableNode>(tableKey)?.getColumnCount()),
    ).toBe(2);
    expectTableDOM(kernel, tableKey, 2);
    expect(lexical.getEditorState().read(() => $getRoot().getTextContent())).toContain('x');
  });
});
