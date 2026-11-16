import type { TableNode } from '@lexical/table';
import { cx } from '@lobehub/ui';
import type { LexicalEditor } from 'lexical';
import { GripHorizontalIcon, GripVerticalIcon } from 'lucide-react';
import {
  type FC,
  type PointerEvent as ReactPointerEvent,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';

import { getKernelFromEditor } from '@/editor-kernel/utils';
import type { IBlockMenuService } from '@/plugins/block/service';

import {
  MOVE_TABLE_COLUMN_COMMAND,
  MOVE_TABLE_ROW_COMMAND,
  SELECT_TABLE_COMMAND,
} from '../../command';
import type { ITableControllerMenuService, TableControllerMenuAxis } from '../../service';
import TableMenu, { type TableMenuPlacement } from '../TableMenu';
import {
  getTableElement,
  indexAtPoint,
  measure,
  readHover,
  type TableGeometry,
  type TableHover,
} from './geometry';
import InsertDot from './InsertDot';
import { styles } from './style';

export interface TableGripsProps {
  blockMenuService?: IBlockMenuService | null;
  editor: LexicalEditor;
  menuService: ITableControllerMenuService | null;
  node: TableNode;
}

interface OpenMenu {
  anchor: HTMLElement;
  axis: TableControllerMenuAxis;
  placement: TableMenuPlacement;
  selectedIndexes: number[];
}

const DRAG_THRESHOLD = 4;
const HIDE_DELAY = 200;
const MENU_SUPPRESSOR_KEY = '__table_grips_menu';

const range = (from: number, to: number) =>
  Array.from({ length: Math.abs(to - from) + 1 }, (_, i) => Math.min(from, to) + i);

const TableGrips: FC<TableGripsProps> = ({ blockMenuService, editor, menuService, node }) => {
  const layerRef = useRef<HTMLDivElement>(null);
  const hideTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const anchors = useRef<{ column?: number; row?: number }>({});
  const drag = useRef<{
    axis: 'column' | 'row';
    index: number;
    moved: boolean;
    x: number;
    y: number;
  }>(undefined);
  const [editable, setEditable] = useState(() => editor.isEditable());
  const [hover, setHover] = useState<TableHover | null>(null);
  const [geometry, setGeometry] = useState<TableGeometry | null>(null);
  const [menu, setMenu] = useState<OpenMenu | null>(null);
  const menuOpen = useRef(false);
  const tableKey = node.getKey();

  useEffect(() => editor.registerEditableListener(setEditable), [editor]);

  const keepVisible = useCallback(() => clearTimeout(hideTimer.current), []);
  const scheduleHide = useCallback(() => {
    clearTimeout(hideTimer.current);
    if (menuOpen.current) return;
    hideTimer.current = setTimeout(() => setHover(null), HIDE_DELAY);
  }, []);

  useEffect(() => {
    const element = editor.getElementByKey(tableKey);
    if (!element || !editable) return;
    const handleOver = (event: PointerEvent) => {
      if (menuOpen.current) return;
      const next = readHover(editor, event.target);
      if (!next) return;
      keepVisible();
      setHover((current) =>
        current?.row === next.row && current.column === next.column ? current : next,
      );
    };
    element.addEventListener('pointerover', handleOver);
    element.addEventListener('pointerleave', scheduleHide);
    return () => {
      element.removeEventListener('pointerover', handleOver);
      element.removeEventListener('pointerleave', scheduleHide);
      clearTimeout(hideTimer.current);
    };
  }, [editable, editor, keepVisible, scheduleHide, tableKey]);

  useLayoutEffect(() => {
    const table = getTableElement(editor, node);
    const layer = layerRef.current;
    if (!hover || !table || !layer) {
      setGeometry(null);
      return;
    }
    const update = () => setGeometry(measure(table, layer.getBoundingClientRect(), hover));
    update();
    window.addEventListener('scroll', update, true);
    window.addEventListener('resize', update);
    return () => {
      window.removeEventListener('scroll', update, true);
      window.removeEventListener('resize', update);
    };
  }, [editor, hover, node]);

  useEffect(() => {
    menuOpen.current = Boolean(menu);
    if (!menu) scheduleHide();
  }, [menu, scheduleHide]);

  useEffect(() => {
    blockMenuService?.setMenuSuppressed(MENU_SUPPRESSOR_KEY, Boolean(menu));
    return () => blockMenuService?.setMenuSuppressed(MENU_SUPPRESSOR_KEY, false);
  }, [blockMenuService, menu]);

  const closeMenu = useCallback(() => setMenu(null), []);

  const openMenu = (
    anchor: HTMLElement,
    axis: TableControllerMenuAxis,
    index: number | undefined,
    extend: boolean,
  ) => {
    const key = axis === 'table' ? undefined : axis;
    const from = key && extend ? (anchors.current[key] ?? index!) : index;
    if (key && !extend) anchors.current[key] = index;
    editor.dispatchCommand(SELECT_TABLE_COMMAND, {
      anchorIndex: from,
      columnIndex: axis === 'column' ? index : undefined,
      extend,
      rowIndex: axis === 'row' ? index : undefined,
      table: tableKey,
    });
    setMenu({
      anchor,
      axis,
      placement: { column: 'bottom', row: 'right', table: 'bottomStart' }[
        axis
      ] as TableMenuPlacement,
      selectedIndexes: axis === 'table' ? [] : range(from!, index!),
    });
  };

  const startDrag = (axis: 'column' | 'row', index: number) => (event: ReactPointerEvent) => {
    if (event.button !== 0) return;
    drag.current = { axis, index, moved: false, x: event.clientX, y: event.clientY };
    const table = getTableElement(editor, node);
    const handleMove = (moveEvent: PointerEvent) => {
      const state = drag.current;
      if (!state) return;
      if (Math.hypot(moveEvent.clientX - state.x, moveEvent.clientY - state.y) > DRAG_THRESHOLD) {
        state.moved = true;
      }
    };
    const handleUp = (upEvent: PointerEvent) => {
      window.removeEventListener('pointermove', handleMove);
      window.removeEventListener('pointerup', handleUp);
      const state = drag.current;
      if (!state?.moved || !table) return;
      const target = indexAtPoint(table, axis, axis === 'row' ? upEvent.clientY : upEvent.clientX);
      if (!target || target.index === index) return;
      if (axis === 'row') {
        editor.dispatchCommand(MOVE_TABLE_ROW_COMMAND, {
          insertAfter: target.insertAfter,
          rowIndex: target.index,
          selectedRows: [index],
          table: tableKey,
        });
      } else {
        editor.dispatchCommand(MOVE_TABLE_COLUMN_COMMAND, {
          columnIndex: target.index,
          insertAfter: target.insertAfter,
          selectedColumns: [index],
          table: tableKey,
        });
      }
    };
    window.addEventListener('pointermove', handleMove);
    window.addEventListener('pointerup', handleUp);
  };

  const handleClick =
    (axis: TableControllerMenuAxis, index?: number) =>
    (event: React.MouseEvent<HTMLButtonElement>) => {
      if (drag.current?.moved) {
        drag.current = undefined;
        return;
      }
      drag.current = undefined;
      openMenu(event.currentTarget, axis, index, event.shiftKey);
    };

  const kernel = getKernelFromEditor(editor);
  const t = (
    key: Parameters<NonNullable<typeof kernel>['t']>[0],
    options?: Record<string, number>,
  ) => kernel?.t(key, options) ?? key;

  if (!editable || !menuService) return <div className={styles.layer} ref={layerRef} />;

  const columnCenter = geometry ? geometry.column.left + geometry.column.width / 2 : 0;
  const columnVisible =
    !!geometry &&
    columnCenter >= geometry.table.left &&
    columnCenter <= geometry.table.left + geometry.table.width;

  const items = menu
    ? menuService.getItems({ axis: menu.axis, editor, node, selectedIndexes: menu.selectedIndexes })
    : [];

  return (
    <div
      className={styles.layer}
      contentEditable={false}
      onPointerEnter={keepVisible}
      onPointerLeave={scheduleHide}
      ref={layerRef}
    >
      {geometry && hover && (
        <>
          <button
            aria-expanded={menu?.axis === 'row' || undefined}
            aria-label={t('table.gripRow', { index: hover.row + 1 })}
            className={cx(styles.grip, styles.gripRow)}
            onClick={handleClick('row', hover.row)}
            onMouseDown={(event) => event.preventDefault()}
            onPointerDown={startDrag('row', hover.row)}
            style={{
              left: geometry.table.left - 6,
              top: geometry.row.top + geometry.row.height / 2 - 11,
            }}
            type="button"
          >
            <GripVerticalIcon size={10} />
          </button>
          {columnVisible && (
            <button
              aria-expanded={menu?.axis === 'column' || undefined}
              aria-label={t('table.gripColumn', { index: hover.column + 1 })}
              className={cx(styles.grip, styles.gripColumn)}
              onClick={handleClick('column', hover.column)}
              onMouseDown={(event) => event.preventDefault()}
              onPointerDown={startDrag('column', hover.column)}
              style={{
                left: geometry.column.left + geometry.column.width / 2 - 11,
                top: geometry.table.top - 6,
              }}
              type="button"
            >
              <GripHorizontalIcon size={10} />
            </button>
          )}
          <button
            aria-expanded={menu?.axis === 'table' || undefined}
            aria-label={t('table.gripTable')}
            className={cx(styles.grip, styles.gripCorner)}
            onClick={handleClick('table')}
            onMouseDown={(event) => event.preventDefault()}
            style={{ left: geometry.table.left - 6, top: geometry.table.top - 6 }}
            type="button"
          />
        </>
      )}
      <InsertDot
        editor={editor}
        label={(axis) => t(axis === 'row' ? 'table.insertRow' : 'table.insertColumn')}
        layerRef={layerRef}
        node={node}
      />
      {menu && items.length > 0 && (
        <TableMenu
          anchor={menu.anchor}
          context={{ axis: menu.axis, editor, node, selectedIndexes: menu.selectedIndexes }}
          items={items}
          onClose={closeMenu}
          placement={menu.placement}
        />
      )}
    </div>
  );
};

export default TableGrips;
