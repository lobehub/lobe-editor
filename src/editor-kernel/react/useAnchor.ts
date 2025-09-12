'use client';

import { useMemo } from 'react';

import { useLexicalComposerContext } from '@/editor-kernel/react/react-context';

export const useAnchor = () => {
  const [editor] = useLexicalComposerContext();
  // Don't render portal on server side

  return useMemo(() => {
    if (typeof document === 'undefined' || !editor) return;
    const root = editor.getRootElement();
    const anchor = root ? root.parentElement : null;
    return anchor || document.body;
  }, [editor]);
};
