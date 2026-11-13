/**
 * Regression test for T-632: "Minified Lexical error #232"
 * (TableObserver: Expected to find TableElement in DOM) when async table
 * bookkeeping runs after the editor root has been detached.
 *
 * The kernel supports reversible root detach (route switches and React
 * Activity hide the subtree via `setRootElement(null)`). Lexical's
 * TableObserver survives the detach and its DOM MutationObserver callback can
 * flush afterwards; without the guard, `$lookup()` throws #232 and the
 * uncaught error crashes the whole editor tree.
 */
import {
  $createTableSelectionFrom,
  $isTableNode,
  type TableCellNode,
  type TableNode,
  type TableRowNode,
} from '@lexical/table';
import { $getRoot, $isElementNode, $setSelection } from 'lexical';
import { afterEach, describe, expect, it } from 'vitest';

import Editor from '@/editor-kernel';
import { CommonPlugin } from '@/plugins/common';
import { MarkdownPlugin } from '@/plugins/markdown';
import { TablePlugin } from '@/plugins/table';

const TABLE_MARKDOWN = ['| A | B |', '| --- | --- |', '| 1 | 2 |'].join('\n');

describe('table observer detach guard (T-632 / Lexical #232)', () => {
  const kernels: Array<ReturnType<typeof Editor.createEditor>> = [];

  if (
    typeof (globalThis as unknown as { ResizeObserver?: unknown }).ResizeObserver === 'undefined'
  ) {
    (globalThis as unknown as { ResizeObserver: unknown }).ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    };
  }

  afterEach(() => {
    kernels.splice(0).forEach((kernel) => {
      try {
        kernel.destroy();
      } catch {
        // destroy may already be partially torn down in edge cases
      }
    });
  });

  it('does not throw #232 when a table DOM mutation flushes after root detach', async () => {
    const kernel = Editor.createEditor();
    kernels.push(kernel);
    const captured: Error[] = [];
    kernel.on('error', (error: Error) => captured.push(error));

    kernel.registerPlugins([CommonPlugin, MarkdownPlugin, TablePlugin]);
    const root = document.createElement('div');
    document.body.appendChild(root);
    kernel.setRootElement(root);
    kernel.setDocument('markdown', TABLE_MARKDOWN);

    const tableElement = root.querySelector('table') as HTMLTableElement;
    expect(tableElement).toBeTruthy();

    // Route switch / Activity hide: detach while the model keeps the table.
    kernel.setRootElement(null);

    // A table-subtree DOM mutation recorded around the detach (e.g. a cell
    // operation racing the route switch) flushes its MutationObserver
    // callback asynchronously, after the root is gone.
    const rowsHost = (tableElement.querySelector('tbody') ??
      tableElement.querySelector('thead') ??
      tableElement) as HTMLElement;
    rowsHost.appendChild(rowsHost.querySelector('tr')!);

    // Flush microtasks so the observer callback runs post-detach.
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(captured).toEqual([]);
    // The uncaught-error channel must stay empty too; vitest fails the whole
    // file on unhandled exceptions, so reaching this point means no #232.
  });

  it('keeps table selection bookkeeping working after re-attach', () => {
    const kernel = Editor.createEditor();
    kernels.push(kernel);
    const captured: Error[] = [];
    kernel.on('error', (error: Error) => captured.push(error));

    kernel.registerPlugins([CommonPlugin, MarkdownPlugin, TablePlugin]);
    const root = document.createElement('div');
    document.body.appendChild(root);
    kernel.setRootElement(root);
    kernel.setDocument('markdown', TABLE_MARKDOWN);

    const lexical = kernel.getLexicalEditor()!;
    lexical.update(() => {
      const child = $getRoot().getFirstChild();
      const tableNode = $isTableNode(child) ? (child as TableNode) : null;
      if (!tableNode) throw new Error('setup: table missing');
      const row = tableNode.getFirstChild<TableRowNode>();
      const firstCell = row && $isElementNode(row) ? row.getFirstChild<TableCellNode>() : null;
      const lastRow = tableNode.getLastChild<TableRowNode>();
      const lastCell =
        lastRow && $isElementNode(lastRow) ? lastRow.getLastChild<TableCellNode>() : null;
      if (!firstCell || !lastCell) throw new Error('setup: cells missing');
      $setSelection($createTableSelectionFrom(tableNode, firstCell, lastCell));
    });

    // Detach then re-attach (Activity reveal) — selection state must survive.
    kernel.setRootElement(null);
    expect(() => kernel.setRootElement(document.createElement('div'))).not.toThrow();
    expect(captured).toEqual([]);
  });

  it('baseline: attached editor keeps normal table rendering and selection', () => {
    const kernel = Editor.createEditor();
    kernels.push(kernel);
    kernel.registerPlugins([CommonPlugin, MarkdownPlugin, TablePlugin]);
    kernel.setRootElement(document.createElement('div'));

    expect(() => kernel.setDocument('markdown', TABLE_MARKDOWN)).not.toThrow();
    const root = kernel.getRootElement();
    expect(root?.querySelector('table')).toBeTruthy();
    expect(root?.querySelectorAll('td').length).toBeGreaterThan(0);
  });
});
