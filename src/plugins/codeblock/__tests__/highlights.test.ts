import { isSupportedLanguage } from '@pierre/highlights';
import { describe, expect, it } from 'vitest';

import type { ITextNode } from '@/editor-kernel/inode/text-node';

import {
  getHighlightSerializeNode,
  isCodeLanguageSupported,
  isCodeThemeLoaded,
  loadCodeTheme,
} from '../plugin/FacadeHighlights';
import { getCodeLanguageByInput } from '../utils/language';
import { codeLanguages } from '../utils/languages';

const styles = (code: string, language: string, theme?: string) =>
  getHighlightSerializeNode(code, language, theme)
    .filter((node) => node.type === 'code-highlight')
    .map((node) => (node as ITextNode).style);

describe('codeblock highlighting', () => {
  it('highlights every listed language through its id or an alias', () => {
    const unsupported = codeLanguages.filter(
      (lang) => ![lang.id, ...(lang.aliases ?? [])].some((id) => isSupportedLanguage(id)),
    );
    expect(unsupported).toEqual([]);
    expect(codeLanguages.every((lang) => isCodeLanguageSupported(lang.id))).toBe(true);
  });

  it('keeps stored language ids when normalizing fence input', () => {
    expect(getCodeLanguageByInput('ts')).toBe('typescript');
    expect(getCodeLanguageByInput('SH')).toBe('shellscript');
    expect(getCodeLanguageByInput('brainfudge')).toBe('plaintext');
  });

  it('colors tokens with the lobe theme variables by default', () => {
    const result = styles('const ids: string[] = [];', 'typescript');
    expect(result.some((style) => /^color: var\(--lobe-/.test(style))).toBe(true);
  });

  it('resolves a language that highlights only knows by alias', () => {
    expect(isCodeLanguageSupported('common-lisp')).toBe(true);
    expect(styles('(defun f (x) x)', 'common-lisp').some(Boolean)).toBe(true);
  });

  it('renders unsupported languages as plain text in the foreground color', () => {
    expect(isCodeLanguageSupported('brainfudge')).toBe(false);
    const nodes = getHighlightSerializeNode('const a = 1', 'brainfudge');
    expect(nodes.map((node) => (node as ITextNode).text).join('')).toBe('const a = 1');
    expect(new Set(styles('const a = 1', 'brainfudge'))).toEqual(
      new Set(['color: var(--lobe-color-text);']),
    );
  });

  it('writes --shiki- variables for a light and dark theme pair', () => {
    const result = styles('const a = 1', 'typescript', 'lobe-theme lobe-theme');
    expect(result.some((style) => style.includes('--shiki-light:var(--lobe-'))).toBe(true);
    expect(result.some((style) => style.includes('--shiki-dark:var(--lobe-'))).toBe(true);
  });

  it('marks diff prefixes and highlights the rest with the base language', () => {
    const nodes = getHighlightSerializeNode('+const a = 1', 'diff-typescript');
    expect(nodes[0]).toMatchObject({ highlightType: 'inserted', text: '+' });
    expect(styles('+const a = 1', 'diff-typescript').some((s) => s.includes('--lobe-'))).toBe(true);
  });

  it('ignores the pending update mark and loads bundled themes on demand', async () => {
    expect(isCodeThemeLoaded('lobe-theme needUpdate')).toBe(true);
    expect(isCodeThemeLoaded('github-dark')).toBe(false);
    await loadCodeTheme('github-dark');
    expect(isCodeThemeLoaded('github-dark')).toBe(true);
    expect(styles('const a = 1', 'typescript', 'github-dark').some((s) => s.includes('#'))).toBe(
      true,
    );
  });

  it('falls back to the lobe theme for an unknown theme id', async () => {
    await loadCodeTheme('not-a-theme');
    expect(isCodeThemeLoaded('not-a-theme')).toBe(true);
    expect(
      styles('const a = 1', 'typescript', 'not-a-theme').some((s) => s.includes('--lobe-')),
    ).toBe(true);
  });
});
