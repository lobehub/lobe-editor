import { useEffect, useMemo, useRef } from 'react';

import Editor from '@/editor-kernel';
import type { IEditor } from '@/types';

export const useEditor = (): IEditor => {
  const editor = useMemo(() => Editor.createEditor(), []);

  // 用于区分 React StrictMode 模拟卸载和真正卸载
  const pendingDestroyRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    // StrictMode remount 时取消待执行的 destroy
    if (pendingDestroyRef.current) {
      pendingDestroyRef.current();
      pendingDestroyRef.current = null;
    }

    return () => {
      // 延迟到 microtask 执行，给 StrictMode remount 留出时间
      pendingDestroyRef.current = () => {
        editor.destroy();
      };
      queueMicrotask(() => {
        if (pendingDestroyRef.current) {
          pendingDestroyRef.current();
          pendingDestroyRef.current = null;
        }
      });
    };
  }, [editor]);

  return editor;
};
