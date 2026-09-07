import { useEffect, useMemo } from 'react';

import Editor from '@/editor-kernel';
import type { IEditor } from '@/types';

export interface UseEditorOptions {
  /**
   * Destroy the kernel when the owning component is cleaned up.
   *
   * The default is false because React Activity also runs effect cleanup while
   * hiding a subtree. Detaching the root keeps the editor reversible and lets
   * the same kernel be attached again when the subtree becomes visible.
   * `autoDestroy: true` is intended for permanent owners that never use
   * Activity hide/show.
   */
  autoDestroy?: boolean;
}

export const useEditor = ({ autoDestroy = false }: UseEditorOptions = {}): IEditor => {
  const editor = useMemo(() => Editor.createEditor(), []);

  useEffect(() => {
    return () => {
      if (autoDestroy) {
        editor.destroy();
        return;
      }

      // Hook-owned editors must release root-scoped global references when
      // their React owner is cleaned up. This remains reversible for Activity.
      if (editor.getLexicalEditor()) {
        editor.setRootElement(null);
      }
    };
  }, [autoDestroy, editor]);

  return editor;
};
