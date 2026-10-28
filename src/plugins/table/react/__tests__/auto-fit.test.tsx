import { $createTableNodeWithDimensions, $isTableCellNode, $isTableNode } from '@lexical/table';
import type { LexicalEditor } from 'lexical';
import { $getRoot, $isElementNode, PASTE_TAG } from 'lexical';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import Editor from '@/editor-kernel';
import { CommonPlugin } from '@/plugins/common';
import { MarkdownPlugin } from '@/plugins/markdown';
import type { IEditor } from '@/types';

import { TablePlugin } from '../../plugin';
import { useAutoFitPastedTable } from '../useAutoFitPastedTable';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT =
  true;

globalThis.ResizeObserver ??= class {
  disconnect() {}
  observe() {}
  unobserve() {}
} as unknown as typeof ResizeObserver;

const AutoFit = ({ editor }: { editor: LexicalEditor }) => {
  useAutoFitPastedTable(editor);
  return null;
};

const flushFrames = async () => {
  for (let index = 0; index < 8; index += 1) {
    await act(async () => {
      await new Promise((resolve) => requestAnimationFrame(() => resolve(null)));
    });
  }
};

describe('useAutoFitPastedTable', () => {
  let kernel: IEditor;
  let lexical: LexicalEditor;
  let editorRoot: HTMLDivElement;
  let host: HTMLDivElement;
  let root: Root;

  const readColWidths = () =>
    lexical
      .getEditorState()
      .read(() => $getRoot().getChildren().find($isTableNode)?.getColWidths());

  const pasteTable = (cellWidth: number) => {
    lexical.update(
      () => {
        const table = $createTableNodeWithDimensions(2, 2, true);
        for (const row of table.getChildren()) {
          if (!$isElementNode(row)) continue;
          for (const cell of row.getChildren()) {
            if ($isTableCellNode(cell)) cell.setWidth(cellWidth);
          }
        }
        $getRoot().append(table);
      },
      { discrete: true, tag: PASTE_TAG },
    );
  };

  beforeEach(() => {
    vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(600);
    vi.spyOn(Element.prototype, 'getBoundingClientRect').mockReturnValue({
      bottom: 40,
      height: 40,
      left: 0,
      right: 120,
      toJSON: () => ({}),
      top: 0,
      width: 120,
      x: 0,
      y: 0,
    } as DOMRect);
    kernel = Editor.createEditor();
    kernel.registerPlugins([CommonPlugin, MarkdownPlugin, TablePlugin]);
    kernel.initNodeEditor();
    lexical = kernel.getLexicalEditor()!;
    editorRoot = document.createElement('div');
    editorRoot.contentEditable = 'true';
    document.body.append(editorRoot);
    lexical.setRootElement(editorRoot);
    host = document.createElement('div');
    document.body.append(host);
    root = createRoot(host);
    act(() => root.render(<AutoFit editor={lexical} />));
  });

  afterEach(() => {
    act(() => root.unmount());
    host.remove();
    lexical.setRootElement(null);
    editorRoot.remove();
    vi.restoreAllMocks();
  });

  it('leaves a loaded table without widths fluid', async () => {
    kernel.setDocument('markdown', '| a | b |\n| --- | --- |\n| 1 | 2 |\n');
    await flushFrames();

    expect(readColWidths()).toBeUndefined();
  });

  it('fits a pasted table that carries cell widths', async () => {
    pasteTable(300);
    await flushFrames();

    expect(readColWidths()).toHaveLength(2);
  });

  it('fits a pasted table inside its frame border', async () => {
    const getComputedStyle = window.getComputedStyle.bind(window);
    vi.spyOn(window, 'getComputedStyle').mockImplementation((element, pseudo) => {
      const style = getComputedStyle(element, pseudo);
      if (element.tagName !== 'TABLE') return style;
      return { ...style, borderInlineEndWidth: '1px', borderInlineStartWidth: '1px' };
    });
    pasteTable(300);
    await flushFrames();

    const widths = readColWidths()!;
    expect(widths.reduce((total, width) => total + width, 0)).toBe(598);
  });

  it('leaves a pasted table with only the default cell width fluid', async () => {
    pasteTable(75);
    await flushFrames();

    expect(readColWidths()).toBeUndefined();
  });
});
