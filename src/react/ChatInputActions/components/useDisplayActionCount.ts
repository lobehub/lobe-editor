import { useEffect, useMemo, useState } from 'react';

import type { ChatInputActionItem } from '../type';
import { useContainerSize } from './useContainerSize';

interface UseDisplayActionCountOptions {
  autoCollapse?: boolean;
  collapseOffset?: number;
  items?: ChatInputActionItem[];
}

export const useDisplayActionCount = ({
  items = [],
  collapseOffset = 0,
  autoCollapse,
}: UseDisplayActionCountOptions = {}) => {
  const { ref, size } = useContainerSize();
  const [collapsed, setCollapsed] = useState(false);
  const flatItems = useMemo(
    () =>
      items
        .flatMap((item) => {
          if (item.type === 'collapse' && item.children) {
            return item.children;
          }
          return item;
        })
        .filter((item) => item.type !== 'divider'),
    [items],
  );

  const alwaysDisplayCount = useMemo(
    () => items.filter((item: any) => item.alwaysDisplay).length,
    [items],
  );
  const rawMaxCount = useMemo(() => flatItems.length + 1, [flatItems.length]);
  const [maxCount, setMaxCount] = useState(rawMaxCount);

  useEffect(() => {
    if (!autoCollapse) {
      setCollapsed(false);
      setMaxCount(rawMaxCount);
      return;
    }

    if (!size) return;

    const atLeastCount = 1 + alwaysDisplayCount;

    let calcMaxCount = Math.floor((size - collapseOffset) / 38);
    if (calcMaxCount < atLeastCount) calcMaxCount = atLeastCount;
    setCollapsed(calcMaxCount < rawMaxCount);
    if (calcMaxCount >= rawMaxCount) return;
    setMaxCount(calcMaxCount);
  }, [autoCollapse, size, rawMaxCount, collapseOffset, alwaysDisplayCount]);

  return useMemo(() => ({ collapsed, maxCount, ref }), [collapsed, maxCount, ref]);
};
