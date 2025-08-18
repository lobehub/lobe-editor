import { EditorThemeClasses, isHTMLElement } from 'lexical';
import { debounce } from 'lodash-es';
import { useMemo, useRef } from 'react';

import type { IEditor } from '@/types';

export function getThemeSelector(iEditor: IEditor, name: keyof EditorThemeClasses): string {
  const className = iEditor.getTheme()?.[name];
  if (typeof className !== 'string') {
    throw new Error(`getThemeClass: required theme property ${name} not defined`);
  }
  return className
    .split(/\s+/g)
    .map((cls) => `.${cls}`)
    .join(',');
}

export function getMouseInfo(
  event: MouseEvent,
  iEditor: IEditor,
): {
  isOutside: boolean;
  tableDOMNode: HTMLElement | null;
} {
  const target = event.target;
  const tableCellClass = getThemeSelector(iEditor, 'tableCell');

  if (isHTMLElement(target)) {
    const tableDOMNode = target.closest<HTMLElement>(`td${tableCellClass}, th${tableCellClass}`);

    const isOutside = !(
      tableDOMNode ||
      target.closest<HTMLElement>(`div.tableAddRows`) ||
      target.closest<HTMLElement>(`div.tableAddColumns`) ||
      target.closest<HTMLElement>('div.TableCellResizer__resizer')
    );

    return { isOutside, tableDOMNode };
  } else {
    return { isOutside: true, tableDOMNode: null };
  }
}

export function useDebounce<T extends (...args: never[]) => void>(
  fn: T,
  ms: number,
  maxWait?: number,
) {
  const funcRef = useRef<T | null>(null);
  funcRef.current = fn;

  return useMemo(
    () =>
      debounce(
        (...args: Parameters<T>) => {
          if (funcRef.current) {
            funcRef.current(...args);
          }
        },
        ms,
        { maxWait },
      ),
    [ms, maxWait],
  );
}
