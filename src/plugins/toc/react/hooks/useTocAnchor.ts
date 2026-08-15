import { type RefObject, useLayoutEffect, useState } from 'react';

import type { IEditor } from '@/types';

export interface TocAnchor {
  bottomTop: number;
  bottomed: boolean;
  left: number;
  slotTop: number;
  stuck: boolean;
  top: number;
  width: number;
}

interface UseTocAnchorOptions {
  editor: IEditor;
  offsetTop: number;
  pinned: boolean;
  slotRef: RefObject<HTMLDivElement | null>;
}

export function useTocAnchor({
  editor,
  offsetTop,
  pinned,
  slotRef,
}: UseTocAnchorOptions): TocAnchor | null {
  const [tocAnchor, setTocAnchor] = useState<TocAnchor | null>(null);

  useLayoutEffect(() => {
    let frameId: null | number = null;

    const measure = () => {
      const slot = slotRef.current;
      const rect = slot?.getBoundingClientRect();
      const rootElement = editor.getRootElement();
      const rootRect = rootElement?.getBoundingClientRect();
      if (!slot || !rect || !rootRect) return;

      const tocRect = (slot.firstElementChild as HTMLElement | null)?.getBoundingClientRect();
      const tocHeight = tocRect?.height ?? 0;
      const offsetParentRect = (slot.offsetParent as HTMLElement | null)?.getBoundingClientRect();
      const slotTop = rootRect.top - (offsetParentRect?.top ?? 0);
      const top = Math.max(rootRect.top, offsetTop);
      const bottomed =
        pinned && rootRect.top <= offsetTop && rootRect.bottom <= offsetTop + tocHeight;
      const bottomTop = Math.max(0, rootRect.height - tocHeight);
      const stuck = rootRect.top <= offsetTop && !bottomed;

      setTocAnchor((current) => {
        if (
          current &&
          current.bottomed === bottomed &&
          current.bottomTop === bottomTop &&
          current.left === rect.left &&
          current.slotTop === slotTop &&
          current.stuck === stuck &&
          current.top === top &&
          current.width === rect.width
        ) {
          return current;
        }

        return { bottomTop, bottomed, left: rect.left, slotTop, stuck, top, width: rect.width };
      });
    };

    const scheduleMeasure = () => {
      if (frameId !== null) return;

      frameId = window.requestAnimationFrame(() => {
        frameId = null;
        measure();
      });
    };

    measure();
    editor.on('initialized', scheduleMeasure);
    document.addEventListener('scroll', scheduleMeasure, { capture: true, passive: true });
    window.addEventListener('resize', scheduleMeasure);

    return () => {
      if (frameId !== null) {
        window.cancelAnimationFrame(frameId);
      }

      editor.off('initialized', scheduleMeasure);
      document.removeEventListener('scroll', scheduleMeasure, true);
      window.removeEventListener('resize', scheduleMeasure);
    };
  }, [editor, offsetTop, pinned, slotRef]);

  return tocAnchor;
}
