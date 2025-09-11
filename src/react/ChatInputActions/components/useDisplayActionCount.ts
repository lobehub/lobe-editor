import { useEffect, useMemo, useState } from 'react';

import { useWidth } from '@/react/hooks/useSize';

import type { ChatInputActionItem } from '../type';

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
  const { ref, width } = useWidth();
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

    if (!width) return;

    const atLeastCount = 1 + alwaysDisplayCount;

    let calcMaxCount = Math.floor((width - collapseOffset) / 38);
    if (calcMaxCount < atLeastCount) calcMaxCount = atLeastCount;
    setCollapsed(calcMaxCount < rawMaxCount);
    if (calcMaxCount >= rawMaxCount) return;
    setMaxCount(calcMaxCount);
  }, [autoCollapse, width, rawMaxCount, collapseOffset, alwaysDisplayCount]);

  return useMemo(() => ({ collapsed, maxCount, ref }), [collapsed, maxCount, ref]);
};
