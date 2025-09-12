// hooks/useContainerSize.ts
import { debounce } from 'lodash-es';
import { useCallback, useEffect, useRef, useState } from 'react';

interface UseContainerSizeOptions {
  debounceMs?: number;
}

export const useWidth = (options: UseContainerSizeOptions = {}) => {
  const { debounceMs = 100 } = options;
  const ref = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState<number>();
  const resizeObserverRef = useRef<ResizeObserver>(null);

  const updateSize = useCallback(
    debounce((entries: ResizeObserverEntry[]) => {
      if (entries[0]) {
        const { width } = entries[0].contentRect;
        setSize(Math.floor(width));
      }
    }, debounceMs),
    [debounceMs],
  );

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    resizeObserverRef.current = new ResizeObserver(updateSize);
    resizeObserverRef.current.observe(element);

    return () => {
      if (resizeObserverRef.current) {
        resizeObserverRef.current.disconnect();
        updateSize.cancel?.();
      }
    };
  }, [updateSize]);

  return { ref, width: size };
};

export const useHeight = (options: UseContainerSizeOptions = {}) => {
  const { debounceMs = 100 } = options;
  const ref = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState<number>();
  const resizeObserverRef = useRef<ResizeObserver>(null);

  const updateSize = useCallback(
    debounce((entries: ResizeObserverEntry[]) => {
      if (entries[0]) {
        const { height } = entries[0].contentRect;
        setSize(Math.floor(height));
      }
    }, debounceMs),
    [debounceMs],
  );

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    resizeObserverRef.current = new ResizeObserver(updateSize);
    resizeObserverRef.current.observe(element);

    return () => {
      if (resizeObserverRef.current) {
        resizeObserverRef.current.disconnect();
        updateSize.cancel?.();
      }
    };
  }, [updateSize]);

  return { height: size, ref };
};
