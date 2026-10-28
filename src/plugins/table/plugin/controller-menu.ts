import { $deleteTableRowAtSelection } from '@lexical/table';
import { $getNodeByKey } from 'lexical';

import type { IEditorKernel } from '@/types';

import {
  AUTO_FIT_TABLE_COLUMN_WIDTH_COMMAND,
  DISTRIBUTE_TABLE_COLUMN_WIDTH_COMMAND,
  INSERT_TABLE_COLUMN_COMMAND,
  INSERT_TABLE_ROW_COMMAND,
  SYNC_TABLE_COLUMN_WIDTH_COMMAND,
} from '../command';
import { SET_TABLE_COLUMN_ALIGN_COMMAND } from '../command/align';
import {
  $deleteTableColumnAtSelectionWithAlign,
  $getTableColumnAligns,
  type TableColumnAlign,
} from '../node/column-align';
import type {
  ITableControllerMenuItem,
  ITableControllerMenuRenderContext,
  ITableControllerMenuService,
  TableControllerMenuAxis,
} from '../service';
import { getSelectedRange } from './helpers';

type Context = ITableControllerMenuRenderContext;

const ALIGNS: Exclude<TableColumnAlign, null>[] = ['left', 'center', 'right'];
const ALIGN_LABELS = {
  center: 'table.alignCenter',
  left: 'table.alignLeft',
  right: 'table.alignRight',
} as const;

const onAxis =
  (axis: TableControllerMenuAxis) =>
  ({ axis: current }: Context) =>
    current === axis;

const onSelectedColumns = ({ axis, selectedIndexes }: Context) =>
  axis === 'column' && selectedIndexes.length > 0;

const isColumnAligned = (
  { editor, node, selectedIndexes }: Context,
  align: Exclude<TableColumnAlign, null>,
) =>
  editor.getEditorState().read(() => {
    const aligns = $getTableColumnAligns(node.getLatest());
    return selectedIndexes.every((index) => aligns[index] === align);
  });

export function createTableControllerMenuItems(kernel: IEditorKernel): ITableControllerMenuItem[] {
  const t = kernel.t.bind(kernel);
  const countLabel =
    (
      one: 'table.deleteColumn' | 'table.deleteRow',
      many: 'table.deleteColumns' | 'table.deleteRows',
    ) =>
    ({ selectedIndexes }: Context) =>
      selectedIndexes.length > 1 ? t(many, { count: selectedIndexes.length }) : t(one);

  return [
    {
      key: '__table_column_insert_before',
      label: t('table.insertColumnLeft'),
      onClick: ({ editor, node, selectedIndexes }) => {
        editor.dispatchCommand(INSERT_TABLE_COLUMN_COMMAND, {
          columnIndex: getSelectedRange(selectedIndexes).start,
          insertAfter: false,
          table: node.getKey(),
        });
      },
      order: 10,
      preview: 'insert-before',
      when: onAxis('column'),
    },
    {
      key: '__table_column_insert_after',
      label: t('table.insertColumnRight'),
      onClick: ({ editor, node, selectedIndexes }) => {
        editor.dispatchCommand(INSERT_TABLE_COLUMN_COMMAND, {
          columnIndex: getSelectedRange(selectedIndexes).end,
          insertAfter: true,
          table: node.getKey(),
        });
      },
      order: 20,
      preview: 'insert-after',
      when: onAxis('column'),
    },
    {
      key: '__table_column_separator_align',
      order: 30,
      type: 'separator',
      when: onSelectedColumns,
    },
    {
      key: '__table_column_label_align',
      label: t('table.align'),
      order: 31,
      type: 'label',
      when: onSelectedColumns,
    },
    {
      key: '__table_column_align',
      options: ALIGNS.map((align) => ({
        active: (context) => isColumnAligned(context, align),
        key: `align-${align}`,
        label: t(ALIGN_LABELS[align]),
        onClick: ({ editor, node, selectedIndexes }) => {
          editor.dispatchCommand(SET_TABLE_COLUMN_ALIGN_COMMAND, {
            align,
            columnIndexes: selectedIndexes,
            table: node.getKey(),
            toggle: true,
          });
        },
      })),
      order: 32,
      type: 'segmented',
      when: onSelectedColumns,
    },
    {
      key: '__table_column_label_width',
      label: t('table.columnWidth'),
      order: 40,
      type: 'label',
      when: onSelectedColumns,
    },
    {
      key: '__table_column_auto_fit_width',
      label: t('table.autoFitWidth'),
      onClick: ({ editor, node, selectedIndexes }) => {
        editor.dispatchCommand(AUTO_FIT_TABLE_COLUMN_WIDTH_COMMAND, {
          columnIndexes: selectedIndexes,
          table: node.getKey(),
        });
      },
      order: 41,
      when: onSelectedColumns,
    },
    {
      key: '__table_column_distribute_width',
      label: t('table.distributeWidth'),
      onClick: ({ editor, node }) => {
        editor.dispatchCommand(DISTRIBUTE_TABLE_COLUMN_WIDTH_COMMAND, { table: node.getKey() });
      },
      order: 42,
      when: onSelectedColumns,
    },
    {
      key: '__table_column_sync_width',
      label: t('table.syncWidth'),
      onClick: ({ editor, node, selectedIndexes }) => {
        const columnIndex = selectedIndexes[0];
        if (columnIndex === undefined) return;
        editor.dispatchCommand(SYNC_TABLE_COLUMN_WIDTH_COMMAND, {
          columnIndex,
          table: node.getKey(),
        });
      },
      order: 43,
      when: onSelectedColumns,
    },
    {
      key: '__table_column_separator_delete',
      order: 50,
      type: 'separator',
      when: onAxis('column'),
    },
    {
      danger: true,
      key: '__table_column_delete',
      label: countLabel('table.deleteColumn', 'table.deleteColumns'),
      onClick: ({ editor }) => {
        editor.update(() => {
          $deleteTableColumnAtSelectionWithAlign();
        });
      },
      order: 51,
      preview: 'delete',
      when: onAxis('column'),
    },
    {
      key: '__table_row_insert_above',
      label: t('table.insertRowAbove'),
      onClick: ({ editor, node, selectedIndexes }) => {
        editor.dispatchCommand(INSERT_TABLE_ROW_COMMAND, {
          insertAfter: false,
          rowIndex: getSelectedRange(selectedIndexes).start,
          table: node.getKey(),
        });
      },
      order: 10,
      preview: 'insert-before',
      when: onAxis('row'),
    },
    {
      key: '__table_row_insert_below',
      label: t('table.insertRowBelow'),
      onClick: ({ editor, node, selectedIndexes }) => {
        editor.dispatchCommand(INSERT_TABLE_ROW_COMMAND, {
          insertAfter: true,
          rowIndex: getSelectedRange(selectedIndexes).end,
          table: node.getKey(),
        });
      },
      order: 20,
      preview: 'insert-after',
      when: onAxis('row'),
    },
    { key: '__table_row_separator_delete', order: 50, type: 'separator', when: onAxis('row') },
    {
      danger: true,
      key: '__table_row_delete',
      label: countLabel('table.deleteRow', 'table.deleteRows'),
      onClick: ({ editor }) => {
        editor.update(() => {
          $deleteTableRowAtSelection();
        });
      },
      order: 51,
      preview: 'delete',
      when: onAxis('row'),
    },
    {
      key: '__table_distribute_width',
      label: t('table.distributeWidth'),
      onClick: ({ editor, node }) => {
        editor.dispatchCommand(DISTRIBUTE_TABLE_COLUMN_WIDTH_COMMAND, { table: node.getKey() });
      },
      order: 10,
      when: onAxis('table'),
    },
    { key: '__table_separator_delete', order: 50, type: 'separator', when: onAxis('table') },
    {
      danger: true,
      key: '__table_delete',
      label: t('table.delete'),
      onClick: ({ editor, node }) => {
        editor.update(() => {
          $getNodeByKey(node.getKey())?.remove();
        });
      },
      order: 51,
      when: onAxis('table'),
    },
  ];
}

export function registerTableControllerMenu(
  menuService: ITableControllerMenuService,
  kernel: IEditorKernel,
): Array<() => void> {
  return createTableControllerMenuItems(kernel).map((item) => menuService.registerItem(item));
}
