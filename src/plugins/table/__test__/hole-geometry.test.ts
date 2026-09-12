import {
  $createTableNodeWithDimensions,
  $isTableNode,
  type TableCellNode,
  type TableNode,
  type TableRowNode,
} from '@lexical/table';
import { $createParagraphNode, $createTextNode, $getNodeByKey, $getRoot } from 'lexical';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import Editor, { moment } from '@/editor-kernel';
import { CommonPlugin } from '@/plugins/common';

import { TablePlugin } from '../plugin';
import { styles as tableStyles } from '../react/style';
import { styles as commonStyles } from '../../common/react/style';

const settle = async (): Promise<void> => {
  await moment();
  await moment();
};

describe('Table Hole visual geometry', () => {
  let editor: ReturnType<typeof Editor.createEditor> | undefined;
  let notifyResize: (() => void) | undefined;

  beforeEach(() => {
    vi.stubGlobal(
      'ResizeObserver',
      class {
        constructor(callback: () => void) {
          notifyResize = callback;
        }

        observe(): void {}
        disconnect(): void {}
      },
    );
  });

  afterEach(() => {
    editor?.destroy();
    editor = undefined;
    notifyResize = undefined;
    document.body.replaceChildren();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('marks the scrollable table host for start-aligned Hole boundaries', async () => {
    editor = Editor.createEditor().registerPlugins([
      CommonPlugin,
      [TablePlugin, { theme: tableStyles }],
    ]);
    let tableKey: string | undefined;
    const wrapper = document.createElement('div');
    wrapper.className = commonStyles.root;
    const root = document.createElement('div');
    root.contentEditable = 'true';
    wrapper.append(root);
    document.body.append(wrapper);
    const lexical = editor.setRootElement(root);

    lexical.update(() => {
      const table = $createTableNodeWithDimensions(1, 2, false);
      tableKey = table.getKey();
      const row = table.getFirstChild() as TableRowNode;
      row.getChildren().forEach((cell, index) => {
        (cell as TableCellNode).append(
          $createParagraphNode().append($createTextNode(index === 0 ? 'left' : 'right')),
        );
      });
      $getRoot().append(table);
    });
    await settle();

    const hole = root.querySelector<HTMLElement>('[data-hole="true"]');
    const content = hole?.querySelector<HTMLElement>(':scope > [data-hole-content="true"]');
    const tableHost = content?.querySelector<HTMLElement>(
      ':scope > [data-hole-content-layout="intrinsic-start"]',
    );
    if (!hole || !content || !tableHost) throw new Error('Table Hole DOM missing');

    expect(tableHost.dataset.holeContentLayout).toBe('intrinsic-start');
    expect(tableHost.querySelector('.lobe-editor-table-scroll-wrapper')).not.toBeNull();
    expect(getComputedStyle(hole).display).toBe('grid');
    expect(getComputedStyle(content).width).toBe('fit-content');
    expect(getComputedStyle(content).marginInlineStart).toBe('0');
    expect(getComputedStyle(content).marginInlineEnd).toBe('0');

    const before = hole.querySelector<HTMLElement>('[data-hole-cursor-hit="before"]');
    const after = hole.querySelector<HTMLElement>('[data-hole-cursor-hit="after"]');
    if (!before || !after) throw new Error('Table Hole boundary hit areas missing');
    expect(getComputedStyle(before).position).toBe('static');
    expect(getComputedStyle(after).position).toBe('static');
    expect(getComputedStyle(before).justifySelf).toBe('end');
    expect(getComputedStyle(after).justifySelf).toBe('start');
    expect(getComputedStyle(hole).gridTemplateColumns).toContain('fit-content(100%)');

    const table = tableHost.querySelector('table');
    if (!table) throw new Error('Table element missing');
    const scrollWrapper = tableHost.querySelector<HTMLElement>(
      ':scope > .lobe-editor-table-scroll-wrapper',
    );
    if (!scrollWrapper) throw new Error('Table scroll wrapper missing');
    vi.spyOn(hole, 'getBoundingClientRect').mockReturnValue(new DOMRect(0, 100, 320, 300));
    vi.spyOn(table, 'getBoundingClientRect').mockReturnValue(new DOMRect(0, 130, 276, 200));
    notifyResize?.();
    // The geometry callback runs outside Lexical's commit. Flush the native
    // MutationObserver as well: moving an unmanaged controller onto the
    // managed TableNode host currently makes Lexical remove it here.
    await settle();
    expect(scrollWrapper.hasAttribute('data-hole-table-viewport')).toBe(true);
    expect(getComputedStyle(scrollWrapper).marginInline).toBe('0px');
    expect(getComputedStyle(table).marginInline).toBe('0px');
    expect(getComputedStyle(scrollWrapper.querySelector('.toolbar-col')!).insetInlineStart).toBe(
      '0px',
    );
    const rowToolbar = tableHost.querySelector<HTMLElement>(':scope > .toolbar-row');
    if (!rowToolbar) throw new Error('Table row toolbar missing');
    expect(rowToolbar.parentElement).toBe(tableHost);
    expect(rowToolbar.hasAttribute('data-hole-table-overlay')).toBe(true);
    expect(getComputedStyle(rowToolbar).insetInlineStart).toBe('0px');
    scrollWrapper.scrollLeft = 12;
    scrollWrapper.dispatchEvent(new Event('scroll'));
    expect(rowToolbar.style.transform).toBe('translateX(-12px)');
    expect(hole.style.getPropertyValue('--lobe-hole-layout-block-start')).toBe('30px');
    expect(hole.style.getPropertyValue('--lobe-hole-layout-block-end')).toBe('70px');

    lexical.update(() => {
      const tableNode = tableKey ? $getNodeByKey(tableKey) : null;
      if (!$isTableNode(tableNode)) throw new Error('Table node missing');
      (tableNode as TableNode).setRowStriping(true);
    });
    await settle();
    expect(table.hasAttribute('data-lexical-row-striping')).toBe(true);
    scrollWrapper.dispatchEvent(new Event('scroll'));
    await settle();
    expect(tableHost.querySelectorAll(':scope > .toolbar-row')).toHaveLength(1);
    expect(scrollWrapper.querySelectorAll(':scope > .toolbar-row')).toHaveLength(0);
    expect(rowToolbar.parentElement).toBe(tableHost);
    expect(rowToolbar.style.transform).toBe('translateX(-12px)');
  });

  it('keeps a normal Hole full width when no visual layout hint is present', () => {
    const wrapper = document.createElement('div');
    wrapper.className = commonStyles.root;
    const root = document.createElement('div');
    wrapper.append(root);
    document.body.append(wrapper);

    const hole = document.createElement('div');
    hole.dataset.hole = 'true';
    const content = document.createElement('div');
    content.dataset.holeContent = 'true';
    const before = document.createElement('span');
    before.dataset.holeCursorHit = 'before';
    const after = document.createElement('span');
    after.dataset.holeCursorHit = 'after';
    hole.append(content, before, after);
    root.append(hole);

    expect(getComputedStyle(hole).display).toBe('block');
    expect(getComputedStyle(content).width).toBe('100%');
    expect(getComputedStyle(before).position).toBe('absolute');
    expect(getComputedStyle(after).position).toBe('absolute');
  });

  it('keeps legacy table row controls outside the horizontal scroller', async () => {
    editor = Editor.createEditor().registerPlugins([[TablePlugin, { theme: tableStyles }]]);
    const root = document.createElement('div');
    root.contentEditable = 'true';
    document.body.append(root);
    const lexical = editor.setRootElement(root);

    lexical.update(() => {
      const table = $createTableNodeWithDimensions(1, 2, false);
      const row = table.getFirstChild() as TableRowNode;
      row.getChildren().forEach((cell, index) => {
        (cell as TableCellNode).append(
          $createParagraphNode().append($createTextNode(index === 0 ? 'left' : 'right')),
        );
      });
      $getRoot().append(table);
    });
    await settle();

    const tableHost = root.querySelector<HTMLElement>('.editor_table_scrollable_wrapper');
    const scrollWrapper = tableHost?.querySelector<HTMLElement>(
      ':scope > .lobe-editor-table-scroll-wrapper',
    );
    const rowToolbar = tableHost?.querySelector<HTMLElement>(':scope > .toolbar-row');
    if (!tableHost || !scrollWrapper || !rowToolbar) throw new Error('Legacy table DOM missing');
    expect(rowToolbar.parentElement).toBe(tableHost);
    expect(scrollWrapper.querySelector(':scope > .toolbar-row')).toBeNull();
    scrollWrapper.scrollLeft = 12;
    scrollWrapper.dispatchEvent(new Event('scroll'));
    expect(rowToolbar.style.transform).toBe('translateX(-12px)');
    await settle();
    expect(tableHost.querySelectorAll(':scope > .toolbar-row')).toHaveLength(1);
  });
});
