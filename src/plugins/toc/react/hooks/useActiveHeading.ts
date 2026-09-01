import { useEffect } from 'react';

import type { IEditor } from '@/types';

import type { ITocService } from '../../service';
import {
  type GetTocScrollContainer,
  resolveTocScrollContainer,
} from '../getNearestScrollContainer';

interface UseActiveHeadingOptions {
  editor: IEditor;
  getScrollContainer?: GetTocScrollContainer;
  offsetTop: number;
  service: ITocService | null;
}

export function useActiveHeading({
  editor,
  getScrollContainer,
  offsetTop,
  service,
}: UseActiveHeadingOptions) {
  useEffect(() => {
    const lexicalEditor = editor.getLexicalEditor();
    if (!lexicalEditor || !service) {
      service?.setActiveKey(null);
      return;
    }

    const scrollContainer = resolveTocScrollContainer(editor, getScrollContainer);
    let frameId: null | number = null;

    const measure = () => {
      const flatItems = service.getFlatItems();
      if (flatItems.length === 0) {
        service.setActiveKey(null);
        return;
      }

      let nextActiveKey = flatItems[0]?.key ?? null;
      const containerTop =
        scrollContainer instanceof Window ? 0 : scrollContainer.getBoundingClientRect().top;

      for (const item of flatItems) {
        const element = lexicalEditor.getElementByKey(item.key);
        if (!element) continue;

        const top = element.getBoundingClientRect().top - containerTop;
        if (top <= offsetTop + 1) {
          nextActiveKey = item.key;
        } else {
          break;
        }
      }

      service.setActiveKey(nextActiveKey);
    };

    const scheduleMeasure = () => {
      if (frameId !== null) return;

      frameId = window.requestAnimationFrame(() => {
        frameId = null;
        measure();
      });
    };

    measure();
    const scrollOptions = { passive: true } as const;
    const documentScrollOptions = { capture: true, passive: true } as const;
    scrollContainer.addEventListener('scroll', scheduleMeasure, scrollOptions);
    document.addEventListener('scroll', scheduleMeasure, documentScrollOptions);
    window.addEventListener('resize', scheduleMeasure);

    return () => {
      if (frameId !== null) {
        window.cancelAnimationFrame(frameId);
      }

      scrollContainer.removeEventListener('scroll', scheduleMeasure, false);
      document.removeEventListener('scroll', scheduleMeasure, true);
      window.removeEventListener('resize', scheduleMeasure);
    };
  }, [editor, getScrollContainer, offsetTop, service]);
}
