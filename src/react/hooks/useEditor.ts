import { useEffect, useMemo, useRef } from 'react';

import Editor from '@/editor-kernel';
import type { IEditor } from '@/types';

export const useEditor = (): IEditor => {
  const editor = useMemo(() => Editor.createEditor(), []);

  // 用于区分 React StrictMode 模拟卸载和真正卸载
  const pendingDestroyRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    // StrictMode 假卸载后会在同一轮再次 mount：只取消 microtask 里的 destroy，切勿在此调用 destroy，
    // 否则会在子组件 setRootElement 之后执行，把刚挂好的 Lexical 实例清掉（文档站无法输入）。
    if (pendingDestroyRef.current) {
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
