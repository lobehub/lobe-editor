import type { EditorThemeClasses } from 'lexical';
import type { Context } from 'react';
import { createContext as createReactContext, use } from 'react';

import { IEditor } from '@/types';

import { assert } from '../utils';

export type LexicalComposerContextType = {
  getTheme: () => EditorThemeClasses | null | undefined;
};

export type LexicalComposerContextWithEditor = [IEditor, LexicalComposerContextType];

export const LexicalComposerContext: Context<LexicalComposerContextWithEditor | null | undefined> =
  createReactContext<LexicalComposerContextWithEditor | null | undefined>(null);

export function createLexicalComposerContext(
  parent: LexicalComposerContextWithEditor | null | undefined,
  theme: EditorThemeClasses | null | undefined,
): LexicalComposerContextType {
  let parentContext: LexicalComposerContextType | null = null;

  if (parent) {
    parentContext = parent[1];
  }

  function getTheme() {
    if (theme !== null) {
      return theme;
    }

    return parentContext !== null ? parentContext.getTheme() : null;
  }

  return {
    getTheme,
  };
}

export function useLexicalComposerContext(): LexicalComposerContextWithEditor {
  const composerContext = use(LexicalComposerContext);

  if (!composerContext) {
    assert(
      false,
      'LexicalComposerContext.useLexicalComposerContext: cannot find a LexicalComposerContext',
    );
  }

  return composerContext;
}
