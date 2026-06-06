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

  const legacyToolbar = element.querySelector(':scope > .toolbar');
  if (legacyToolbar instanceof HTMLElement) {
    // Old structure only had a single `.toolbar`, which is the lexical decorator host.
    legacyToolbar.className = 'toolbar-col';
    markTableControllerHost(legacyToolbar, true);
    scrollWrapper.append(legacyToolbar);
  }

  const ensureToolbar = (parent: HTMLElement, className: string, withDecorator = false) => {
    const existingToolbar = parent.querySelector(`:scope > .${className}`);
    if (existingToolbar instanceof HTMLElement) {
      markTableControllerHost(existingToolbar, withDecorator);
      return;
    }

    if (!existingToolbar) {
      const toolbar = document.createElement('div');
      toolbar.className = className;
      markTableControllerHost(toolbar, withDecorator);
      parent.append(toolbar);
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
    element.append(legacyPlainToolbar);
  }

  ensureToolbar(scrollWrapper, 'toolbar-col', true);
  ensureToolbar(element, 'toolbar-row', true);
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

export function patchTableNode() {
  if (TableNode.prototype.createDOM !== OriginalCreateDOM) {
    return;
  }
  Object.defineProperty(TableNode.prototype, 'createDOM', {
    configurable: true,
    enumerable: false,
    value: function (config: EditorConfig, editor: LexicalEditor) {
      const table = OriginalCreateDOM.call(this, config, editor);
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
