/* eslint-disable unicorn/prefer-at */
import { DRAG_AUTO_SCROLL_EDGE, DRAG_AUTO_SCROLL_MAX_STEP } from '../core/constants';
import { type DragBlockEntry, type DragInsertionSlot } from '../core/types';

const toRectSnapshot = (rect: DOMRect): DragBlockEntry['rect'] => ({
  bottom: rect.bottom,
  height: rect.height,
  left: rect.left,
  top: rect.top,
  width: rect.width,
});

export const isTableBlockElement = (element: HTMLElement) => {
  return (
    element instanceof HTMLTableElement ||
    Boolean(element.querySelector('table.editor_table, table'))
  );
};

export const getTableBlockRect = (element: HTMLElement): DragBlockEntry['rect'] | null => {
  const table =
    element instanceof HTMLTableElement
      ? element
      : element.querySelector('table.editor_table, table');

  if (!(table instanceof HTMLElement)) {
    return null;
  }

  const tableRect = table.getBoundingClientRect();
  const firstCell = table.querySelector('th, td');

  if (firstCell instanceof HTMLElement) {
    const cellRect = firstCell.getBoundingClientRect();
    if (cellRect.width > 0 && cellRect.height > 0) {
      return {
        bottom: tableRect.height > 0 ? tableRect.bottom : cellRect.bottom,
        height: tableRect.height > 0 ? tableRect.height : cellRect.height,
        left: cellRect.left,
        top: tableRect.height > 0 ? tableRect.top : cellRect.top,
        width: tableRect.width > 0 ? tableRect.width : cellRect.width,
      };
    }
  }

  if (tableRect.height <= 0) {
    return null;
  }

  return toRectSnapshot(tableRect);
};

export const getBlockMeasureRect = (block: HTMLElement): DragBlockEntry['rect'] | null => {
  const rect = isTableBlockElement(block)
    ? getTableBlockRect(block)
    : toRectSnapshot(block.getBoundingClientRect());

  if (!rect || rect.height <= 0) {
    return null;
  }

  return rect;
};

export const collectDragBlocks = (root: HTMLElement | null): DragBlockEntry[] => {
  if (!root) return [];

  return Array.from(root.querySelectorAll<HTMLElement>('[data-block-id]'))
    .reduce<DragBlockEntry[]>((acc, block) => {
      const blockId = block.dataset.blockId;
      if (!blockId) return acc;

      const rect = getBlockMeasureRect(block);
      if (!rect) return acc;

      acc.push({
        block,
        blockId,
        rect,
      });
      return acc;
    }, [])
    .sort((a, b) => a.rect.top - b.rect.top);
};

export const resolveScrollContainers = (root: HTMLElement | null): HTMLElement[] => {
  if (!root) return [];

  let element: HTMLElement | null = root;
  const containers: HTMLElement[] = [];

  while (element) {
    const style = window.getComputedStyle(element);
    const overflowY = style.overflowY;
    const scrollable =
      (overflowY === 'auto' || overflowY === 'scroll') &&
      element.scrollHeight > element.clientHeight;

    if (scrollable) {
      containers.push(element);
    }

    element = element.parentElement;
  }

  const pageScroller = document.scrollingElement as HTMLElement | null;
  if (pageScroller && !containers.includes(pageScroller)) {
    containers.push(pageScroller);
  }

  return containers;
};

export const getAutoScrollDelta = (pointerY: number, container: HTMLElement): number => {
  const isPageScroller = container === document.scrollingElement;

  const top = isPageScroller ? 0 : container.getBoundingClientRect().top;
  const bottom = isPageScroller ? window.innerHeight : container.getBoundingClientRect().bottom;

  if (pointerY < top + DRAG_AUTO_SCROLL_EDGE) {
    const ratio = (top + DRAG_AUTO_SCROLL_EDGE - pointerY) / DRAG_AUTO_SCROLL_EDGE;
    return -Math.max(1, Math.round(ratio * DRAG_AUTO_SCROLL_MAX_STEP));
  }

  if (pointerY > bottom - DRAG_AUTO_SCROLL_EDGE) {
    const ratio = (pointerY - (bottom - DRAG_AUTO_SCROLL_EDGE)) / DRAG_AUTO_SCROLL_EDGE;
    return Math.max(1, Math.round(ratio * DRAG_AUTO_SCROLL_MAX_STEP));
  }

  return 0;
};

export const resolveNearestInsertionSlot = (
  sourceBlockId: string,
  blocks: DragBlockEntry[],
  y: number,
): DragInsertionSlot | null => {
  if (blocks.length === 0) return null;

  const slots: DragInsertionSlot[] = [];

  const first = blocks[0];
  slots.push({
    left: first.rect.left,
    placement: 'before',
    sourceBlockId,
    targetBlockId: first.blockId,
    width: first.rect.width,
    y: first.rect.top,
  });

  for (let i = 0; i < blocks.length - 1; i++) {
    const next = blocks[i + 1];
    slots.push({
      left: next.rect.left,
      placement: 'before',
      sourceBlockId,
      targetBlockId: next.blockId,
      width: next.rect.width,
      y: next.rect.top,
    });
  }

  const last = blocks[blocks.length - 1];
  slots.push({
    left: last.rect.left,
    placement: 'after',
    sourceBlockId,
    targetBlockId: last.blockId,
    width: last.rect.width,
    y: last.rect.bottom,
  });

  let bestSlot = slots[0];
  let bestDistance = Math.abs(y - bestSlot.y);

  for (let i = 1; i < slots.length; i++) {
    const slot = slots[i];
    const distance = Math.abs(y - slot.y);

    if (distance < bestDistance) {
      bestSlot = slot;
      bestDistance = distance;
    }
  }

  return bestSlot;
};
