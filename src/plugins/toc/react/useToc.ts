'use client';

import { useCallback } from 'react';

import { resolveTocScrollContainer } from './getNearestScrollContainer';
import { useActiveHeading } from './hooks/useActiveHeading';
import { useTocItems } from './hooks/useTocItems';
import type { UseTocOptions, UseTocResult } from './type';

export function useToc({
  behavior = 'smooth',
  editor,
  getScrollContainer,
  maxDepth = 6,
  minDepth = 1,
  offsetTop = 0,
  onItemsChange,
}: UseTocOptions): UseTocResult {
  const { activeKey, items, service } = useTocItems({
    editor,
    maxDepth,
    minDepth,
    onItemsChange,
  });

  useActiveHeading({ editor, getScrollContainer, offsetTop, service });

  const jumpTo = useCallback(
    (key: string) => {
      const container = resolveTocScrollContainer(editor, getScrollContainer);
      service?.jumpTo(key, { behavior, container, offsetTop });
    },
    [behavior, editor, getScrollContainer, offsetTop, service],
  );

  return { activeKey, items, jumpTo, service };
}
