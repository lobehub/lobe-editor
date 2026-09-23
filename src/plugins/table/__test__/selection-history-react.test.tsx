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
  UNDO_COMMAND,
} from 'lexical';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { Doc } from 'yjs';

import { ReactEditor } from '@/editor-kernel/react';
import Editor, { moment } from '@/editor-kernel';
import { ReactEditorContent, ReactPlainText } from '@/plugins/common/react';
import { YjsPlugin } from '@/plugins/yjs/plugin';

import { INSERT_TABLE_COLUMN_COMMAND } from '../command';
import { ReactTablePlugin } from '../react';

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
    this.listeners.get('status')?.forEach((listener) => listener({ status: 'connected' } as never));
    queueMicrotask(() =>
      this.listeners.get('sync')?.forEach((listener) => listener(true as never)),
    );
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

describe('table selection history with mounted React decorators', () => {
  let kernel: ReturnType<typeof Editor.createEditor> | undefined;
  let host: HTMLDivElement | undefined;
  let reactRoot: Root | undefined;
  let doc: Doc | undefined;

  beforeEach(() => {
    class TestResizeObserver {
      observe(): void {}
      disconnect(): void {}
    }
    globalThis.ResizeObserver = TestResizeObserver as unknown as typeof ResizeObserver;
    (
      globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }
    ).IS_REACT_ACT_ENVIRONMENT = true;
    HTMLElement.prototype.scrollIntoView = () => undefined;
    (Text.prototype as Text & { getBoundingClientRect?: () => DOMRect }).getBoundingClientRect =
      () => new DOMRect();
    (Node.prototype as Node & { getBoundingClientRect?: () => DOMRect }).getBoundingClientRect =
      () => new DOMRect();
    (Range.prototype as Range & { getBoundingClientRect?: () => DOMRect }).getBoundingClientRect =
      () => new DOMRect();
  });

  afterEach(() => {
    if (reactRoot) act(() => reactRoot?.unmount());
    kernel?.destroy();
    host?.remove();
    doc?.destroy();
    reactRoot = undefined;
    kernel = undefined;
    host = undefined;
    doc = undefined;
  });

  const settleReact = async () => {
    await act(async () => {
      await moment();
      await moment();
    });
  };

  const expectTableDOM = (
    editor: ReturnType<typeof Editor.createEditor>,
    key: string,
    count: number,
  ) => {
    const hostElement = editor.getLexicalEditor()?.getElementByKey(key);
    const table = hostElement?.querySelector<HTMLTableElement>(':scope table');
    expect(table).not.toBeNull();
    if (!table) return;
    expect(table.querySelectorAll(':scope > colgroup > col')).toHaveLength(count);
    expect(Array.from(table.querySelectorAll('tr'))).toHaveLength(2);
    table.querySelectorAll('tr').forEach((row) => {
      expect(row.querySelectorAll(':scope > td, :scope > th')).toHaveLength(count);
    });
    expect(
      Array.from(table.querySelectorAll<HTMLElement>(':scope > colgroup > col')).map(
        (column) => column.style.width,
      ),
    ).toEqual(Array.from({ length: count }, () => '250px'));
  };

  it('keeps the native table DOM at two columns after immediate Undo2 and input', async () => {
    doc = new Doc();
    const provider = new TestProvider();
    kernel = Editor.createEditor().registerPlugins([
      [
        YjsPlugin,
        {
          id: 'table-selection-history-react',
          providerFactory: () => provider,
          shouldBootstrap: true,
          yjsDoc: doc,
        },
      ],
    ]);
    host = document.createElement('div');
    document.body.append(host);
    reactRoot = createRoot(host);

    await act(async () => {
      reactRoot?.render(
        <ReactEditor editor={kernel}>
          <ReactPlainText>
            <ReactEditorContent content="" type="text" />
          </ReactPlainText>
          <ReactTablePlugin />
        </ReactEditor>,
      );
      await moment();
      await moment();
    });
    await settleReact();

    const lexical = kernel.getLexicalEditor();
    if (!lexical) throw new Error('Lexical editor missing');
    const root = host.querySelector<HTMLElement>('[contenteditable="true"]');
    if (!root) throw new Error('Editor root missing');
    root.focus();

    let tableKey = '';
    lexical.update(() => {
      const table = $createTableNodeWithDimensions(2, 2, false);
      table.setColWidths([250, 250]);
      tableKey = table.getKey();
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
    await settleReact();
    await new Promise((resolve) => setTimeout(resolve, 650));

    lexical.dispatchCommand(INSERT_TABLE_COLUMN_COMMAND, {
      columnIndex: 1,
      insertAfter: true,
      table: tableKey,
    });
    await settleReact();
    await new Promise((resolve) => setTimeout(resolve, 650));
    lexical.dispatchCommand(INSERT_TABLE_COLUMN_COMMAND, {
      columnIndex: 2,
      insertAfter: true,
      table: tableKey,
    });
    await settleReact();

    let anchorKey = '';
    let deletedFocusKey = '';
    lexical.update(() => {
      const table = $getNodeByKey<TableNode>(tableKey);
      if (!$isTableNode(table)) throw new Error('Table missing');
      const [map] = $computeTableMapSkipCellCheck(table, null, null);
      anchorKey = map[1][1].cell.getKey();
      deletedFocusKey = map[1][3].cell.getKey();
      const selection = $createTableSelection();
      selection.set(tableKey, anchorKey, deletedFocusKey);
      $setSelection(selection);
      const tableElement = lexical.getElementByKey(tableKey)?.querySelector('table');
      const observer = tableElement ? getTableObserverFromTableElement(tableElement) : null;
      observer?.$updateTableTableSelection(selection);
    });
    await settleReact();

    lexical.dispatchCommand(UNDO_COMMAND, undefined);
    await settleReact();
    lexical.dispatchCommand(UNDO_COMMAND, undefined);
    lexical.dispatchCommand(
      KEY_ARROW_RIGHT_COMMAND,
      new KeyboardEvent('keydown', { key: 'ArrowRight' }),
    );
    lexical.dispatchCommand(CONTROLLED_TEXT_INSERTION_COMMAND, 'x');
    await settleReact();
    await new Promise((resolve) => setTimeout(resolve, 0));
    await settleReact();

    lexical.getEditorState().read(() => {
      const table = $getNodeByKey<TableNode>(tableKey);
      const selection = $getSelection();
      expect(table?.getColumnCount()).toBe(2);
      expect($isTableSelection(selection)).toBe(false);
      expect($isRangeSelection(selection)).toBe(true);
      if ($isRangeSelection(selection)) {
        expect($getTableCellNodeFromLexicalNode(selection.anchor.getNode())?.getKey()).toBe(
          anchorKey,
        );
        expect($getNodeByKey(deletedFocusKey)).toBeNull();
      }
      expect($getRoot().getTextContent()).toContain('x');
    });
    expectTableDOM(kernel, tableKey, 2);
  });
});
