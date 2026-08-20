import { useEffect, useRef, useState } from 'react';

import type { IEditor } from '@/types';

import { ITocService, type ITocService as TocService } from '../../service';
import type { TocItem } from '../../types';

interface UseTocItemsOptions {
  editor: IEditor;
  maxDepth: number;
  minDepth: number;
  onItemsChange?: (items: TocItem[]) => void;
}

export function useTocItems({ editor, maxDepth, minDepth, onItemsChange }: UseTocItemsOptions) {
  const onItemsChangeRef = useRef(onItemsChange);
  const [service, setService] = useState<TocService | null>(() =>
    editor.requireService(ITocService),
  );
  const [activeKey, setActiveKey] = useState<null | string>(null);
  const [items, setItems] = useState<TocItem[]>([]);

  onItemsChangeRef.current = onItemsChange;

  useEffect(() => {
    let unsubscribeService: (() => void) | undefined;

    const attachService = () => {
      const tocService = editor.requireService(ITocService);
      if (!tocService) return;

      unsubscribeService?.();
      unsubscribeService = undefined;

      tocService.setDepthRange({ maxDepth, minDepth });
      tocService.refresh();
      setService(tocService);

      const sync = () => {
        const nextItems = tocService.getItems();
        setItems(nextItems);
        setActiveKey(tocService.getActiveKey());
        onItemsChangeRef.current?.(nextItems);
      };

      sync();
      unsubscribeService = tocService.subscribe(sync);
    };

    attachService();
    editor.on('initialized', attachService);

    return () => {
      editor.off('initialized', attachService);
      unsubscribeService?.();
    };
  }, [editor, maxDepth, minDepth]);

  return { activeKey, items, service };
}
