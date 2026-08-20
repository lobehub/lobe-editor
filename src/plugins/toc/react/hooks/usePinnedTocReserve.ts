import { useLayoutEffect } from 'react';

import type { IEditor } from '@/types';

import type { TocAnchor } from './useTocAnchor';

interface UsePinnedTocReserveOptions {
  editor: IEditor;
  pinned: boolean;
  reserveGap: number;
  reserveOnPinned: boolean;
  tocAnchor: TocAnchor | null;
}

export function usePinnedTocReserve({
  editor,
  pinned,
  reserveGap,
  reserveOnPinned,
  tocAnchor,
}: UsePinnedTocReserveOptions) {
  useLayoutEffect(() => {
    const rootElement = editor.getRootElement();
    if (!rootElement || !reserveOnPinned || !pinned || !tocAnchor) return;

    const previousPaddingInlineEnd = rootElement.style.paddingInlineEnd;
    const previousBoxSizing = rootElement.style.boxSizing;

    rootElement.style.boxSizing = 'border-box';
    rootElement.style.paddingInlineEnd = `${tocAnchor.width + reserveGap}px`;

    return () => {
      rootElement.style.paddingInlineEnd = previousPaddingInlineEnd;
      rootElement.style.boxSizing = previousBoxSizing;
    };
  }, [editor, pinned, reserveGap, reserveOnPinned, tocAnchor]);
}
