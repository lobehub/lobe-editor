import { TableNode, TableObserver } from '@lexical/table';
import {
  $getNodeByKey,
  type EditorConfig,
  type LexicalEditor,
  type LexicalNode,
  setDOMUnmanaged,
} from 'lexical';

import {
  getKernelFromEditor,
  getKernelFromEditorConfig,
  reconcileDecorator,
} from '@/editor-kernel';
import type { IDecorator, IDecoratorFunc } from '@/types';

const OriginalCreateDOM = TableNode.prototype.createDOM;
const OriginalUpdateDOM = TableNode.prototype.updateDOM;
const SCROLL_INDICATOR_WIDTH = 24;

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

function ensureTableScrollIndicators(scrollWrapper: HTMLElement): void {
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

  if (scrollWrapper.dataset.scrollIndicatorsReady === 'true') {
    updateTableScrollIndicators(scrollWrapper);
    return;
  }

  scrollWrapper.dataset.scrollIndicatorsReady = 'true';
  scrollWrapper.addEventListener('scroll', () => updateTableScrollIndicators(scrollWrapper), {
    passive: true,
  });

  const resizeObserver = new ResizeObserver(() => updateTableScrollIndicators(scrollWrapper));
  resizeObserver.observe(scrollWrapper);
  resizeObserver.observe(scrollWrapper.querySelector('table') ?? scrollWrapper);

  requestAnimationFrame(() => updateTableScrollIndicators(scrollWrapper));
}

function syncTableFluidMarker(element: HTMLElement, node: TableNode): void {
  const table = element instanceof HTMLTableElement ? element : element.querySelector('table');
  if (!table) {
    return;
  }

  if (node.getColWidths()?.length) {
    delete table.dataset.lobeTableFluid;
    return;
  }

  table.dataset.lobeTableFluid = 'true';
  table.style.removeProperty('width');
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

  const hostParent = element instanceof HTMLTableElement ? scrollWrapper : element;

  const legacyToolbar = element.querySelector(':scope > .toolbar');
  if (legacyToolbar instanceof HTMLElement) {
    // Old structure only had a single `.toolbar`, which is the lexical decorator host.
    legacyToolbar.className = 'toolbar-col';
    markTableControllerHost(legacyToolbar, true);
    hostParent.append(legacyToolbar);
  }

  const ensureToolbar = (className: string) => {
    const existingToolbar = hostParent.querySelector(`:scope > .${className}`);
    if (existingToolbar instanceof HTMLElement) {
      markTableControllerHost(existingToolbar, true);
      return;
    }

    const toolbar = document.createElement('div');
    toolbar.className = className;
    markTableControllerHost(toolbar, true);
    hostParent.append(toolbar);
  };

  const legacyDecoratedToolbar = scrollWrapper.querySelector(
    ':scope > .toolbar[data-lexical-decorator]',
  );
  if (legacyDecoratedToolbar instanceof HTMLElement) {
    legacyDecoratedToolbar.className = 'toolbar-col';
  }

  const legacyPlainToolbar = scrollWrapper.querySelector(
    ':scope > .toolbar:not([data-lexical-decorator])',
  );
  if (legacyPlainToolbar instanceof HTMLElement) {
    legacyPlainToolbar.className = 'toolbar-row';
  }

  if (hostParent !== scrollWrapper) {
    for (const host of scrollWrapper.querySelectorAll<HTMLElement>(
      ':scope > .toolbar-col, :scope > .toolbar-row',
    )) {
      if (!hostParent.querySelector(`:scope > .${host.className}`)) {
        hostParent.append(host);
      }
    }
  }

  ensureToolbar('toolbar-col');
  ensureToolbar('toolbar-row');
  ensureTableScrollIndicators(scrollWrapper);
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

/**
 * T-632 / Lexical #232 guard.
 *
 * The editor kernel supports reversible root detach (route switches and React
 * Activity hide the subtree through `setRootElement(null)`). Lexical's
 * TableObserver survives a detach: its DOM MutationObserver and the
 * editor-level SELECTION_CHANGE_COMMAND listener stay registered, and async
 * work flushed after the detach (queued table DOM mutations, selection
 * cleanup) resolves the table element through `$lookup()`. With no root
 * attached, `getElementByKey()` returns null and Lexical throws the uncaught
 * "Minified Lexical error #232" (TableObserver: Expected to find TableElement
 * in DOM), crashing the whole editor tree.
 *
 * While detached — or when the upstream lookup throws on a missing element —
 * degrade to the observer's last-known table element so read-only
 * bookkeeping keeps working instead of taking the editor down.
 */
const LAST_KNOWN_TABLE_ELEMENT = 'lastKnownTableElement';

type ObserverInternals = {
  editor: LexicalEditor;
  tableNodeKey: string;
};

function resolveTableNode(editor: LexicalEditor, tableNodeKey: string): LexicalNode | null {
  return (editor.getEditorState().read(() => $getNodeByKey(tableNodeKey)) ??
    null) as LexicalNode | null;
}

function degradeLookup(
  observer: TableObserver,
  internals: ObserverInternals,
): { tableNode: LexicalNode; tableElement: HTMLElement } | null {
  const lastElement = (observer as unknown as Record<string, unknown>)[LAST_KNOWN_TABLE_ELEMENT] as
    HTMLElement | undefined;

  if (!(lastElement instanceof HTMLElement)) {
    return null;
  }

  const tableNode = resolveTableNode(internals.editor, internals.tableNodeKey);
  if (!tableNode) {
    return null;
  }

  return { tableNode, tableElement: lastElement };
}

export function patchTableNode() {
  if (TableNode.prototype.createDOM !== OriginalCreateDOM) {
    return;
  }

  // Guard the observer's element lookup: the lookup runs from async callbacks
  // (DOM MutationObserver flush, selection cleanup) that can execute after the
  // root has been detached, where upstream throws #232.
  const OriginalLookup = TableObserver.prototype.$lookup;
  if (!OriginalLookup) {
    // @lexical/table builds without dev exports guard; bail defensively.
    return;
  }

  TableObserver.prototype.$lookup = function (
    this: TableObserver,
  ): ReturnType<TableObserver['$lookup']> {
    const internals = this as unknown as ObserverInternals;
    const { editor, tableNodeKey } = internals;

    if (editor && editor.getRootElement() === null) {
      const fallback = degradeLookup(this, internals);
      if (fallback) {
        return fallback as unknown as ReturnType<TableObserver['$lookup']>;
      }
    }

    try {
      const result = OriginalLookup.call(this);
      const element = (result as unknown as { tableElement?: unknown }).tableElement;
      if (element instanceof HTMLElement) {
        (this as unknown as Record<string, unknown>)[LAST_KNOWN_TABLE_ELEMENT] = element;
      }
      return result;
    } catch (error) {
      const fallback = degradeLookup(this, internals);
      if (fallback) {
        return fallback as unknown as ReturnType<TableObserver['$lookup']>;
      }
      throw error;
    }
  };

  Object.defineProperty(TableNode.prototype, 'createDOM', {
    configurable: true,
    enumerable: false,
    value: function (config: EditorConfig, editor: LexicalEditor) {
      const table = OriginalCreateDOM.call(this, config, editor);
      ensureTableControllerDOM(table);
      syncTableFluidMarker(table, this);
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
      ensureTableControllerDOM(_dom);
      syncTableFluidMarker(_dom, this);
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
