import type { IEditor } from '@/types';

export type GetTocScrollContainer = (editor: IEditor) => HTMLElement | Window | null;

export function getNearestScrollContainer(element: HTMLElement | null): HTMLElement | Window {
  if (!element || typeof window === 'undefined') {
    return window;
  }

  let current = element.parentElement;
  while (current) {
    if (current === document.body || current === document.documentElement) {
      return window;
    }

    const style = window.getComputedStyle(current);
    const overflow = `${style.overflow} ${style.overflowY} ${style.overflowX}`;

    if (/(auto|scroll|overlay)/.test(overflow) && current.scrollHeight > current.clientHeight) {
      return current;
    }

    current = current.parentElement;
  }

  return window;
}

export function resolveTocScrollContainer(
  editor: IEditor,
  getScrollContainer?: GetTocScrollContainer,
): HTMLElement | Window {
  return getScrollContainer?.(editor) ?? getNearestScrollContainer(editor.getRootElement());
}
