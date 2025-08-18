import { useCallback } from 'react';

import { ILocaleKeys, TFunction } from '@/types';

import { useLexicalComposerContext } from './react-context';

export function useTranslation(): TFunction {
  const [editor] = useLexicalComposerContext();

  return useCallback(
    <K extends keyof ILocaleKeys>(key: K, options?: Record<string, any>): string =>
      editor.t(key, options),
    [editor],
  ) as TFunction;
}

// Maintain backward compatibility
export const useLocale = useTranslation;
