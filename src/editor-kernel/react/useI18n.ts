import { useCallback } from 'react';

import { II18nKeys } from '@/editor-kernel/types';

import { useLexicalComposerContext } from './react-context';

export function useI18n() {
  const [editor] = useLexicalComposerContext();

  return useCallback(
    (key: keyof II18nKeys, params?: Record<string, any>): string => editor.t(key, params),
    [editor],
  );
}
