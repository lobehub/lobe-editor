'use client';

import { LOBE_THEME_APP_ID } from '@lobehub/ui';
import { useMemo } from 'react';

import { useLexicalComposerContext } from '@/editor-kernel/react/react-context';

export const useAnchor = () => {
  const [editor] = useLexicalComposerContext();
  // Don't render portal on server side

  return useMemo(() => {
    if (typeof document === 'undefined' || !editor) return;
    const root = editor.getRootElement();
    const anchor = root ? root.parentElement : null;
    if (anchor) return anchor;
    // Fallback to .ant-app if exists, otherwise document.body
    const app = document.querySelector(`#${LOBE_THEME_APP_ID}`) as HTMLElement;
    return app || document.body;
  }, [editor]);
};
