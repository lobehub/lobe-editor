import type { Key } from 'react';

import type { ISlashMenuOption, ISlashOption } from '../service/i-slash-service';

export type SlashMenuDirection = 'backward' | 'forward';
export type SlashMenuSpatialDirection = 'down' | 'left' | 'right' | 'up';

export function isSlashDividerOption(option: ISlashOption): boolean {
  return 'type' in option && option.type === 'divider';
}

export function isSlashMenuOption(option: ISlashOption): option is ISlashMenuOption {
  return !isSlashDividerOption(option) && 'key' in option && Boolean(option.key);
}

export function getSelectableSlashOptions(options: ISlashOption[]): ISlashMenuOption[] {
  return options.filter(
    (item): item is ISlashMenuOption => isSlashMenuOption(item) && !item.disabled,
  );
}

export function getNextSlashActiveKey(
  options: ISlashOption[],
  activeKey: Key | null,
  direction: SlashMenuDirection,
): string | null {
  const selectableOptions = getSelectableSlashOptions(options);
  if (selectableOptions.length === 0) return null;

  const currentIndex =
    activeKey === null
      ? -1
      : selectableOptions.findIndex((option) => option.key === String(activeKey));
  const nextIndex =
    direction === 'forward'
      ? currentIndex === -1
        ? 0
        : (currentIndex + 1) % selectableOptions.length
      : currentIndex === -1
        ? selectableOptions.length - 1
        : (currentIndex - 1 + selectableOptions.length) % selectableOptions.length;

  return String(selectableOptions[nextIndex].key);
}

export function findSlashOptionByKey(
  options: ISlashOption[],
  key: Key | null,
): ISlashMenuOption | null {
  if (key === null) return null;

  for (const option of options) {
    if (!isSlashMenuOption(option)) continue;
    if (option.key === String(key)) return option;
  }

  return null;
}

function getLayoutColumnCount(option: ISlashMenuOption): number {
  if (option.layout === 'compact') return 6;
  if (option.layout === 'tile') return 2;

  return 1;
}

function getOptionRows(options: ISlashOption[]): ISlashMenuOption[][] {
  const rows: ISlashMenuOption[][] = [];
  let pendingLayout: ISlashMenuOption['layout'] | null = null;
  let pendingColumns = 1;
  let pendingRow: ISlashMenuOption[] = [];

  const flushPendingRow = () => {
    if (pendingRow.length === 0) return;
    rows.push(pendingRow);
    pendingRow = [];
  };

  for (const option of options) {
    if (!isSlashMenuOption(option) || option.disabled) {
      flushPendingRow();
      pendingLayout = null;
      pendingColumns = 1;
      continue;
    }

    const columns = getLayoutColumnCount(option);
    const layout = option.layout ?? 'wide';

    if (columns === 1) {
      flushPendingRow();
      rows.push([option]);
      pendingLayout = null;
      pendingColumns = 1;
      continue;
    }

    if (pendingLayout !== layout || pendingColumns !== columns || pendingRow.length >= columns) {
      flushPendingRow();
      pendingLayout = layout;
      pendingColumns = columns;
    }

    pendingRow.push(option);
  }

  flushPendingRow();
  return rows;
}

export function getNextSlashSpatialActiveKey(
  options: ISlashOption[],
  activeKey: Key | null,
  direction: SlashMenuSpatialDirection,
): string | null {
  if (direction === 'left') return getNextSlashActiveKey(options, activeKey, 'backward');
  if (direction === 'right') return getNextSlashActiveKey(options, activeKey, 'forward');

  const rows = getOptionRows(options);
  if (rows.length === 0) return null;
  if (activeKey === null) return String(rows[0][0].key);

  const activeRowIndex = rows.findIndex((row) =>
    row.some((option) => option.key === String(activeKey)),
  );
  if (activeRowIndex === -1) return String(rows[0][0].key);

  const activeColumnIndex = rows[activeRowIndex].findIndex(
    (option) => option.key === String(activeKey),
  );
  const nextRowIndex =
    direction === 'down'
      ? (activeRowIndex + 1) % rows.length
      : (activeRowIndex - 1 + rows.length) % rows.length;
  const nextRow = rows[nextRowIndex];
  const nextColumnIndex = Math.min(activeColumnIndex, nextRow.length - 1);

  return String(nextRow[nextColumnIndex].key);
}
