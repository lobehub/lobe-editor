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
   *
   * `autoDestroy: true` is mutually exclusive with React Activity: Activity
   * cannot distinguish a hidden subtree from a permanently unmounted owner,
   * so its cleanup would destroy the editor during a hide. Use the default
   * reversible detach with Activity, and call `destroy()` (or unmount the
   * owner with `autoDestroy`) only when the instance is no longer needed.
   *
   * Root detach releases the kernel from the library's global root registry
   * and DOM/dragon listeners. It does not guarantee garbage collection when
   * application code keeps the `IEditor` in a store, provider, or other
   * long-lived reference. Remove that reference, unmount the owner, or use
   * `autoDestroy: true`/`destroy()` to release the editor's runtime resources.
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

      // A hook-owned editor must release root-scoped global references when
      // its React owner is cleaned up. This is intentionally reversible so
      // React Activity can attach the same editor again when it is shown.
      if (editor.getLexicalEditor()) {
        editor.setRootElement(null);
      }
    };
  }, [autoDestroy, editor]);

  return editor;
};
