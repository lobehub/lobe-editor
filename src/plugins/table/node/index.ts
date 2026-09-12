import { TableNode } from '@lexical/table';
import { type EditorConfig, type LexicalEditor, setDOMUnmanaged } from 'lexical';

import {
  getKernelFromEditor,
  getKernelFromEditorConfig,
  reconcileDecorator,
} from '@/editor-kernel';
import type { IDecorator, IDecoratorFunc } from '@/types';

const OriginalCreateDOM = TableNode.prototype.createDOM;
const OriginalUpdateDOM = TableNode.prototype.updateDOM;
const SCROLL_INDICATOR_WIDTH = 24;
const TABLE_HOLE_CONTENT_LAYOUT = 'intrinsic-start';
const TABLE_HOLE_VIEWPORT_ATTRIBUTE = 'data-hole-table-viewport';
const TABLE_HOLE_ROW_OVERLAY_ATTRIBUTE = 'data-hole-table-overlay';

type TablePortalDecorator = {
  queryDOM: (_element: HTMLElement) => HTMLElement;
  render: IDecoratorFunc;
};

type TableDecorator =
  | IDecorator
  | {
      multi: TablePortalDecorator[];
    };

function markTableControllerHost(element: HTMLElement, withDecorator = false): void {
  setDOMUnmanaged(element);
  if (withDecorator) {
    element.dataset.lexicalDecorator = 'true';
  }
}

/**
 * Keep a table Hole anchored to the table's visible start edge. The table
 * scroll wrapper intentionally bleeds into the editor gutters; the generic
 * Hole layout uses this hint to keep its boundary cursors beside the table
 * instead of stretching them across the whole editor row.
 */
function markTableHoleContentLayout(element: HTMLElement): void {
  element.dataset.holeContentLayout = TABLE_HOLE_CONTENT_LAYOUT;
}

function updateTableScrollIndicators(scrollWrapper: HTMLElement): void {
  const maxScrollLeft = scrollWrapper.scrollWidth - scrollWrapper.clientWidth;
  const scrollLeft = scrollWrapper.scrollLeft;
  const hasOverflow = maxScrollLeft > 1;
  const showStart = hasOverflow && scrollLeft > 1;
  const showEnd = hasOverflow && scrollLeft < maxScrollLeft - 1;
  const startIndicator = scrollWrapper.querySelector<HTMLElement>(
    ':scope > .lobe-editor-table-scroll-indicator-start',
  );
  const endIndicator = scrollWrapper.querySelector<HTMLElement>(
    ':scope > .lobe-editor-table-scroll-indicator-end',
  );

  startIndicator?.classList.toggle('lobe-editor-table-scroll-indicator-visible', showStart);
  endIndicator?.classList.toggle('lobe-editor-table-scroll-indicator-visible', showEnd);

  if (startIndicator) {
    startIndicator.style.transform = `translateX(${scrollLeft}px)`;
  }

  if (endIndicator) {
    endIndicator.style.transform = `translateX(${Math.max(
      scrollLeft + scrollWrapper.clientWidth - SCROLL_INDICATOR_WIDTH,
      0,
    )}px)`;
  }
}

function getTableControllerHost(element: HTMLElement): HTMLElement {
  if (!(element instanceof HTMLTableElement)) return element;

  return (
    element.closest<HTMLElement>('.editor_table_scrollable_wrapper') ??
    element.parentElement ??
    element
  );
}

function syncTableHoleBlockInsets(element: HTMLElement): void {
  const controllerHost = getTableControllerHost(element);
  const hole = controllerHost.closest<HTMLElement>('[data-hole="true"]');
  const table =
    element instanceof HTMLTableElement
      ? element
      : controllerHost.querySelector<HTMLTableElement>(':scope table');
  const scrollWrapper = table?.closest<HTMLElement>('.lobe-editor-table-scroll-wrapper');

  const rowToolbar =
    controllerHost.querySelector<HTMLElement>(':scope > .toolbar-row') ??
    scrollWrapper?.querySelector<HTMLElement>(':scope > .toolbar-row');

  if (rowToolbar && scrollWrapper) {
    // The row host is created as a stable direct child of the TableNode DOM.
    // Lexical observes the outer host as a managed node; reparenting this
    // unmanaged portal host from an async geometry callback makes Lexical
    // remove it as an unknown child. Geometry updates may only touch styles.
    if (rowToolbar.parentElement === controllerHost) {
      if (hole) {
        // Row controls have a deliberate -14px left overhang. Keep that chrome
        // outside the native data scrollport so clipping the table cannot hide
        // the row/corner handles. They still track the table while it scrolls.
        rowToolbar.setAttribute(TABLE_HOLE_ROW_OVERLAY_ATTRIBUTE, 'true');
      } else {
        rowToolbar.removeAttribute(TABLE_HOLE_ROW_OVERLAY_ATTRIBUTE);
      }

      rowToolbar.style.transform = `translateX(${-scrollWrapper.scrollLeft}px)`;
    } else {
      // A legacy host may still be inside the scroll wrapper. Leave its
      // ownership untouched until the next DOM creation rather than moving it
      // from an observed managed parent during an async callback.
      rowToolbar.removeAttribute(TABLE_HOLE_ROW_OVERLAY_ATTRIBUTE);
      rowToolbar.style.removeProperty('transform');
    }
  }

  // The legacy table viewport intentionally bleeds into the block anchor
  // padding. A table mounted in a Hole has a different contract: its data
  // clip must end at the Hole content slot so the exterior boundary caret
  // cannot be painted over by the last cell. Keep this marker on the table's
  // own viewport instead of changing the generic Hole overflow.
  scrollWrapper?.toggleAttribute(TABLE_HOLE_VIEWPORT_ATTRIBUTE, Boolean(hole));

  if (!hole || !table) return;

  // Publish target-owned geometry through generic Hole variables. This keeps
  // CommonPlugin independent of table margins, padding, and custom themes.
  const holeRect = hole.getBoundingClientRect();
  const tableRect = table.getBoundingClientRect();
  hole.style.setProperty(
    '--lobe-hole-layout-block-start',
    `${Math.max(tableRect.top - holeRect.top, 0)}px`,
  );
  hole.style.setProperty(
    '--lobe-hole-layout-block-end',
    `${Math.max(holeRect.bottom - tableRect.bottom, 0)}px`,
  );
}

function ensureTableScrollIndicators(
  scrollWrapper: HTMLElement,
  onGeometryChange?: () => void,
): void {
  const ensureIndicator = (className: string) => {
    const existingIndicator = scrollWrapper.querySelector(`:scope > .${className}`);
    if (existingIndicator instanceof HTMLElement) {
      setDOMUnmanaged(existingIndicator);
      return;
    }

    const indicator = document.createElement('span');
    indicator.className = `lobe-editor-table-scroll-indicator ${className}`;
    setDOMUnmanaged(indicator);
    scrollWrapper.append(indicator);
  };

  ensureIndicator('lobe-editor-table-scroll-indicator-start');
  ensureIndicator('lobe-editor-table-scroll-indicator-end');

  const update = () => {
    updateTableScrollIndicators(scrollWrapper);
    onGeometryChange?.();
  };

  if (scrollWrapper.dataset.scrollIndicatorsReady === 'true') {
    update();
    return;
  }

  scrollWrapper.dataset.scrollIndicatorsReady = 'true';
  scrollWrapper.addEventListener('scroll', update, { passive: true });

  const resizeObserver = new ResizeObserver(update);
  resizeObserver.observe(scrollWrapper);
  resizeObserver.observe(scrollWrapper.querySelector('table') ?? scrollWrapper);

  requestAnimationFrame(update);
}

function ensureTableControllerDOM(element: HTMLElement): void {
  const table = element instanceof HTMLTableElement ? element : element.querySelector('table');

  if (!table) {
    return;
  }

  let scrollWrapper = table.closest('.lobe-editor-table-scroll-wrapper') as HTMLElement | null;

  if (!table.closest('.lobe-editor-table-scroll-wrapper')) {
    scrollWrapper = document.createElement('div');
    scrollWrapper.className = 'lobe-editor-table-scroll-wrapper';
    table.parentElement?.insertBefore(scrollWrapper, table);
    scrollWrapper.append(table);
  }

  if (!scrollWrapper) {
    return;
  }

  const controllerHost = getTableControllerHost(element);
  const syncHoleGeometry = () => syncTableHoleBlockInsets(controllerHost);

  const legacyToolbar = controllerHost.querySelector(':scope > .toolbar');
  if (legacyToolbar instanceof HTMLElement) {
    // Old structure only had a single `.toolbar`, which is the lexical decorator host.
    legacyToolbar.className = 'toolbar-col';
    markTableControllerHost(legacyToolbar, true);
    scrollWrapper.append(legacyToolbar);
  }

  const ensureToolbar = (
    parent: HTMLElement,
    className: string,
    withDecorator = false,
    before?: ChildNode,
  ) => {
    const existingToolbar = parent.querySelector(`:scope > .${className}`);
    if (existingToolbar instanceof HTMLElement) {
      markTableControllerHost(existingToolbar, withDecorator);
      return;
    }

    if (!existingToolbar) {
      const toolbar = document.createElement('div');
      toolbar.className = className;
      markTableControllerHost(toolbar, withDecorator);
      if (before && before.parentElement === parent) parent.insertBefore(toolbar, before);
      else parent.append(toolbar);
    }
  };

  // Split controller rendering into different hosts:
  // - toolbar-col: lexical decorator mount point
  // - toolbar-row: secondary portal host for row/corner controls
  const legacyDecoratedToolbar = scrollWrapper.querySelector(
    ':scope > .toolbar[data-lexical-decorator]',
  );
  if (legacyDecoratedToolbar instanceof HTMLElement) {
    legacyDecoratedToolbar.className = 'toolbar-col';
    markTableControllerHost(legacyDecoratedToolbar, true);
  }

  const legacyPlainToolbar = scrollWrapper.querySelector(
    ':scope > .toolbar:not([data-lexical-decorator])',
  );
  if (legacyPlainToolbar instanceof HTMLElement) {
    legacyPlainToolbar.className = 'toolbar-row';
    markTableControllerHost(legacyPlainToolbar, true);
    // A freshly-created TableNode is still detached, so an old inner host can
    // be moved into the stable outer slot without involving Lexical's
    // observer. Once mounted, keep the legacy host where it is; reparenting it
    // during updateDOM would recreate the same observed child-list race that
    // this slot is designed to avoid.
    if (!controllerHost.isConnected && controllerHost !== scrollWrapper) {
      controllerHost.insertBefore(legacyPlainToolbar, scrollWrapper);
    }
  }

  const legacyOuterRowToolbar = controllerHost.querySelector(':scope > .toolbar-row');
  if (legacyOuterRowToolbar instanceof HTMLElement) {
    markTableControllerHost(legacyOuterRowToolbar, true);
  }

  // Keep the row portal outside the native data scrollport for every table.
  // This host is created while the TableNode DOM is still being built, so its
  // insertion cannot be reverted by Lexical's mutation observer. Later Hole
  // geometry/scroll callbacks only update attributes and transforms.
  const hasInnerRowToolbar =
    scrollWrapper.querySelector<HTMLElement>(':scope > .toolbar-row') !== null;
  if (!hasInnerRowToolbar || controllerHost.querySelector(':scope > .toolbar-row')) {
    ensureToolbar(controllerHost, 'toolbar-row', true, scrollWrapper);
  }
  ensureToolbar(scrollWrapper, 'toolbar-col', true);
  ensureTableScrollIndicators(scrollWrapper, syncHoleGeometry);
}

function reconcileTableDecorator(
  editor: LexicalEditor,
  node: TableNode,
  decorator: TableDecorator | null,
): void {
  if (!decorator) {
    return;
  }

  if (typeof decorator === 'function') {
    reconcileDecorator(editor, node.getKey(), decorator(node, editor));
    return;
  }

  if ('multi' in decorator) {
    const decorators = decorator.multi.map((item) => ({
      queryDOM: item.queryDOM,
      render: item.render(node, editor),
    }));

    reconcileDecorator(editor, node.getKey(), {
      multi: decorators,
    });
    return;
  }

  reconcileDecorator(editor, node.getKey(), {
    queryDOM: decorator.queryDOM,
    render: decorator.render(node, editor),
  });
}

export function patchTableNode() {
  if (TableNode.prototype.createDOM !== OriginalCreateDOM) {
    return;
  }
  Object.defineProperty(TableNode.prototype, 'createDOM', {
    configurable: true,
    enumerable: false,
    value: function (config: EditorConfig, editor: LexicalEditor) {
      const table = OriginalCreateDOM.call(this, config, editor);
      markTableHoleContentLayout(table);
      ensureTableControllerDOM(table);
      const kernel = getKernelFromEditor(editor);
      const decorator = kernel?.getDecorator(TableNode.getType()) || null;
      reconcileTableDecorator(editor, this, decorator);
      return table;
    },
    writable: true,
  });

  Object.defineProperty(TableNode.prototype, 'updateDOM', {
    configurable: true,
    enumerable: false,
    value: function (_prevNode: TableNode, _dom: HTMLElement, _config: EditorConfig) {
      const table = OriginalUpdateDOM.call(this, _prevNode, _dom, _config);
      markTableHoleContentLayout(_dom);
      ensureTableControllerDOM(_dom);
      const kernel = getKernelFromEditorConfig(_config);
      const editor = kernel?.getLexicalEditor();
      if (editor) {
        const decorator = kernel?.getDecorator(TableNode.getType()) || null;
        reconcileTableDecorator(editor, this, decorator);
      }
      return table;
    },
    writable: true,
  });
}

export { TableNode } from '@lexical/table';
