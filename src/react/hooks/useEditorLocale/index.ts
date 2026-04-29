'use client';

import { useCallback, useSyncExternalStore } from 'react';

import { useLexicalComposerContext } from '@/editor-kernel/react/react-context';
import type { IEditor } from '@/types';
import type { ILocaleKeys } from '@/types/locale';

export interface UseEditorLocaleResult {
  /** Replace the entire locale map, triggering a re-render. */
  setLocale: (locale: Partial<Record<keyof ILocaleKeys, string>>) => void;
  /** Translate a locale key. Re-renders when locale changes. */
  t: (key: string, params?: Record<string, any>) => string;
}

let localeVersion = 0;
const listeners = new Set<() => void>();

function subscribeToLocale(callback: () => void) {
  listeners.add(callback);
  return () => {
    listeners.delete(callback);
  };
}

function getLocaleVersion() {
  return localeVersion;
}

function notifyLocaleChange() {
  localeVersion++;
  listeners.forEach((fn) => fn());
}

/**
 * React hook for editor locale access.
 *
 * Usage inside editor tree:
 * ```tsx
 * const { t, setLocale } = useEditorLocale();
 * setLocale(zhCN);
 * ```
 *
 * Usage with explicit editor instance (outside editor context):
 * ```tsx
 * const { t, setLocale } = useEditorLocale(editor);
 * ```
 */
export function useEditorLocale(editor?: IEditor): UseEditorLocaleResult {
  let ctxEditor: IEditor | null = null;
  try {
    const [composerEditor] = useLexicalComposerContext();
    ctxEditor = composerEditor;
  } catch {
    // useLexicalComposerContext may throw when used outside editor tree
  }

  const targetEditor = editor || ctxEditor;

  if (!targetEditor) {
    throw new Error(
      '[useEditorLocale] No editor found. Pass an editor instance or use this hook inside an <Editor> tree.',
    );
  }

  // Subscribe to locale version changes to trigger re-renders
  useSyncExternalStore(subscribeToLocale, getLocaleVersion, getLocaleVersion);

  const setLocale = useCallback(
    (locale: Partial<Record<keyof ILocaleKeys, string>>) => {
      targetEditor.setLocale(locale);
      notifyLocaleChange();
    },
    [targetEditor],
  );

  const t = useCallback(
    (key: string, params?: Record<string, any>): string => {
      return targetEditor.t(key as any, params);
    },
    [targetEditor],
  );

  return { setLocale, t };
}
