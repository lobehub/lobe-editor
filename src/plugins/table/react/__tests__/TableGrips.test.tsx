import { $isTableNode, $isTableSelection, type TableNode } from '@lexical/table';
import type { LexicalEditor } from 'lexical';
import { $getRoot, $getSelection } from 'lexical';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import Editor from '@/editor-kernel';
import { CommonPlugin } from '@/plugins/common';
import { MarkdownPlugin } from '@/plugins/markdown';
import type { IEditor } from '@/types';

import { $getTableColumnAligns } from '../../node/column-align';
import { TablePlugin } from '../../plugin';
import { ITableControllerMenuService } from '../../service';
import TableGrips from '../TableGrips';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT =
  true;

globalThis.ResizeObserver ??= class {
  disconnect() {}
  observe() {}
  unobserve() {}
} as unknown as typeof ResizeObserver;

const MARKDOWN = '| a | b | c |\n| - | - | - |\n| 1 | 2 | 3 |\n| 4 | 5 | 6 |\n';

const press = async (element: Element) => {
  const init = { bubbles: true, button: 0, cancelable: true, clientX: 1, clientY: 1 };
  await act(async () => {
    element.dispatchEvent(new PointerEvent('pointerdown', init));
    element.dispatchEvent(new MouseEvent('mousedown', init));
    element.dispatchEvent(new PointerEvent('pointerup', init));
    element.dispatchEvent(new MouseEvent('mouseup', init));
    element.dispatchEvent(new MouseEvent('click', init));
  });
};

describe('TableGrips', () => {
  let kernel: IEditor;
  let lexical: LexicalEditor;
  let editorRoot: HTMLDivElement;
  let host: HTMLDivElement;
  let root: Root;

  const tableNode = () =>
    lexical.getEditorState().read(() => $getRoot().getChildren().find($isTableNode)!) as TableNode;

  const cell = (row: number, column: number) =>
    editorRoot.querySelectorAll('tr')[row].querySelectorAll('td, th')[column] as HTMLElement;

  const query = (label: string) => document.querySelector<HTMLElement>(`[aria-label="${label}"]`);

  const render = () => {
    act(() => {
      root.render(
        <TableGrips
          editor={lexical}
          menuService={kernel.requireService(ITableControllerMenuService)}
          node={tableNode()}
        />,
      );
    });
  };

  const hover = (row: number, column: number) => {
    act(() => {
      cell(row, column).dispatchEvent(new PointerEvent('pointerover', { bubbles: true }));
    });
  };

  beforeEach(() => {
    kernel = Editor.createEditor();
    kernel.registerPlugins([CommonPlugin, MarkdownPlugin, TablePlugin]);
    kernel.initNodeEditor();
    lexical = kernel.getLexicalEditor()!;
    editorRoot = document.createElement('div');
    editorRoot.contentEditable = 'true';
    document.body.append(editorRoot);
    lexical.setRootElement(editorRoot);
    kernel.setDocument('markdown', MARKDOWN);
    host = document.createElement('div');
    document.body.append(host);
    root = createRoot(host);
  });

  afterEach(() => {
    act(() => root.unmount());
    host.remove();
    lexical.setRootElement(null);
    editorRoot.remove();
  });

  it('shows the row and column grips of the hovered cell', () => {
    render();
    expect(query('Row 2')).toBeNull();

    hover(1, 2);

    expect(query('Row 2')).not.toBeNull();
    expect(query('Column 3')).not.toBeNull();
    expect(query('Row 1')).toBeNull();
  });

  it('selects the column and opens the grouped menu from its grip', async () => {
    render();
    hover(1, 1);
    await press(query('Column 2')!);

    const selected = lexical.getEditorState().read(() => {
      const selection = $getSelection();
      return $isTableSelection(selection) ? selection.getNodes().length : 0;
    });
    expect(selected).toBeGreaterThan(0);
    expect(document.querySelector('[role="menu"]')).not.toBeNull();
    expect(query('Align center')).not.toBeNull();
  });

  it('applies column alignment from a real click sequence on the menu', async () => {
    render();
    hover(1, 1);
    await press(query('Column 2')!);
    await press(query('Align center')!);

    const aligns = lexical.getEditorState().read(() => $getTableColumnAligns(tableNode()));
    expect(aligns[1]).toBe('center');
    expect(document.querySelector('[role="menu"]')).toBeNull();
  });

  it('keeps the open menu anchored when the pointer leaves the table or crosses cells', async () => {
    vi.useFakeTimers();
    try {
      render();
      hover(1, 1);
      await press(query('Column 2')!);
      const anchor = query('Column 2')!;

      act(() => {
        lexical
          .getElementByKey(tableNode().getKey())!
          .dispatchEvent(new PointerEvent('pointerleave'));
        cell(2, 2).dispatchEvent(new PointerEvent('pointerover', { bubbles: true }));
        vi.advanceTimersByTime(500);
      });

      expect(anchor.isConnected).toBe(true);
      expect(query('Column 2')).toBe(anchor);
      expect(query('Column 3')).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });

  it('inserts a row from the row menu', async () => {
    render();
    hover(1, 0);
    await press(query('Row 2')!);
    await press(query('Insert row below')!);

    expect(editorRoot.querySelectorAll('tr')).toHaveLength(4);
  });

  it('opens the table menu from the corner grip', async () => {
    render();
    hover(1, 0);
    await press(query('Table')!);

    expect(query('Delete table')).not.toBeNull();
  });

  it('aligns the table menu to the start edge of the corner grip', async () => {
    render();
    hover(1, 0);
    const corner = query('Table')!;
    corner.getBoundingClientRect = () =>
      ({
        bottom: 112,
        height: 12,
        left: 300,
        right: 312,
        top: 100,
        width: 12,
        x: 300,
        y: 100,
      }) as DOMRect;
    await press(corner);

    const menu = document.querySelector<HTMLElement>('[role="menu"]')!;
    expect(menu.style.insetInlineStart).toBe('300px');
  });

  const stubRects = () => {
    const rect = (left: number, top: number, right: number, bottom: number) =>
      ({
        bottom,
        height: bottom - top,
        left,
        right,
        top,
        width: right - left,
        x: left,
        y: top,
      }) as DOMRect;
    const table = editorRoot.querySelector('table')!;
    table.getBoundingClientRect = () => rect(100, 100, 400, 220);
    [...table.rows].forEach((row, rowIndex) => {
      const top = 100 + rowIndex * 40;
      row.getBoundingClientRect = () => rect(100, top, 400, top + 40);
      [...row.cells].forEach((cellElement, columnIndex) => {
        const left = 100 + columnIndex * 100;
        cellElement.getBoundingClientRect = () => rect(left, top, left + 100, top + 40);
      });
    });
  };

  const movePointer = (clientX: number, clientY: number) => {
    const element = lexical.getElementByKey(tableNode().getKey())!;
    act(() => {
      element.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, clientX, clientY }));
    });
  };

  it('inserts a row from the dot between two rows on the left edge', async () => {
    render();
    stubRects();
    movePointer(98, 141);
    await press(query('Insert row')!);

    const rows = editorRoot.querySelectorAll('tr');
    expect(rows).toHaveLength(4);
    expect(rows[1].textContent).toBe('');
  });

  it('inserts a column from the dot after the last column on the top edge', async () => {
    render();
    stubRects();
    movePointer(401, 98);
    await press(query('Insert column')!);

    expect(editorRoot.querySelectorAll('tr')[0].querySelectorAll('td, th')).toHaveLength(4);
  });

  it('shows no insert dot over the corner grip', () => {
    render();
    stubRects();
    for (const [x, y] of [
      [99, 99],
      [90, 101],
      [101, 90],
    ]) {
      movePointer(x, y);
      expect(query('Insert row')).toBeNull();
      expect(query('Insert column')).toBeNull();
    }
  });

  it('shows no insert dot away from the edges', () => {
    render();
    stubRects();
    movePointer(250, 160);

    expect(query('Insert row')).toBeNull();
    expect(query('Insert column')).toBeNull();
  });

  const stubScrolledRects = () => {
    stubRects();
    const rect = (left: number, top: number, right: number, bottom: number) =>
      ({
        bottom,
        height: bottom - top,
        left,
        right,
        top,
        width: right - left,
        x: left,
        y: top,
      }) as DOMRect;
    const table = editorRoot.querySelector('table')!;
    const wrapper = table.closest<HTMLElement>('.lobe-editor-table-scroll-wrapper')!;
    wrapper.getBoundingClientRect = () => rect(160, 100, 300, 220);
  };

  it('keeps the row grip on the visible edge of a scrolled table', () => {
    render();
    stubScrolledRects();
    hover(1, 0);

    expect(query('Row 2')!.style.left).toBe('154px');
    expect(query('Table')!.style.left).toBe('154px');
  });

  it('hides the column grip of a column scrolled out of view', () => {
    render();
    stubScrolledRects();
    hover(1, 0);
    expect(query('Column 1')).toBeNull();

    hover(1, 1);
    expect(query('Column 2')).not.toBeNull();
  });

  it('limits the row insert line to the visible part of a scrolled table', () => {
    render();
    stubScrolledRects();
    movePointer(158, 141);

    const dot = query('Insert row')!;
    expect(dot.style.left).toBe('152px');
    expect((dot.previousElementSibling as HTMLElement).style.width).toBe('140px');
  });

  it('renders no grips in a read-only editor', () => {
    lexical.setEditable(false);
    render();
    hover(1, 1);

    expect(query('Row 2')).toBeNull();
    expect(query('Column 2')).toBeNull();
  });
});
