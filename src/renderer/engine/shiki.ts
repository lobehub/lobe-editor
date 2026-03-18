import { createHighlighterCoreSync, isSpecialLang, stringifyTokenStyle } from '@shikijs/core';
import { createJavaScriptRegexEngine } from '@shikijs/engine-javascript';
import { type ReactNode, createElement } from 'react';
import { bundledLanguagesInfo } from 'shiki';

let _highlighter: ReturnType<typeof createHighlighterCoreSync> | null = null;
let _themeLoaded = false;

function getHighlighter() {
  if (!_highlighter) {
    _highlighter = createHighlighterCoreSync({
      engine: createJavaScriptRegexEngine(),
      langs: [],
      themes: [],
    });
  }
  return _highlighter;
}

async function ensureTheme(highlighter: ReturnType<typeof createHighlighterCoreSync>) {
  if (_themeLoaded) return;
  try {
    const { ShikiLobeTheme } = await import('@lobehub/ui');
    highlighter.loadThemeSync(ShikiLobeTheme as any);
    _themeLoaded = true;
  } catch {
    // @lobehub/ui not available, skip theme
  }
}

function isLanguageLoaded(language: string): boolean {
  if (isSpecialLang(language)) return true;
  const highlighter = getHighlighter();
  return highlighter.getLoadedLanguages().includes(language);
}

function parseInlineStyle(style: string): Record<string, string> {
  const result: Record<string, string> = {};
  for (const part of style.split(';')) {
    const colonIdx = part.indexOf(':');
    if (colonIdx === -1) continue;
    const prop = part.slice(0, colonIdx).trim();
    const val = part.slice(colonIdx + 1).trim();
    if (!prop || !val) continue;
    const camelProp = prop.replaceAll(/-([a-z])/g, (_, c: string) => c.toUpperCase());
    result[camelProp] = val;
  }
  return result;
}

export async function loadLanguage(language: string): Promise<void> {
  if (isLanguageLoaded(language)) return;
  const info = bundledLanguagesInfo.find(
    (desc) => desc.id === language || desc.aliases?.includes(language),
  );
  if (info) {
    const highlighter = getHighlighter();
    await highlighter.loadLanguage(info.import());
  }
}

export function highlightCode(code: string, language: string, key: string): ReactNode[] | null {
  if (!language || !isLanguageLoaded(language)) return null;

  const highlighter = getHighlighter();
  void ensureTheme(highlighter);

  const theme = _themeLoaded ? 'lobe-theme' : highlighter.getLoadedThemes()[0] || 'none';

  try {
    const { tokens } = highlighter.codeToTokens(code, { lang: language, theme });
    const nodes: ReactNode[] = [];

    for (const [lineIdx, line] of tokens.entries()) {
      if (lineIdx > 0) {
        nodes.push(createElement('br', { key: `${key}-br-${lineIdx}` }));
      }
      for (const [tokenIdx, token] of line.entries()) {
        const tokenStyle = stringifyTokenStyle(
          token.htmlStyle || (token.color ? `color: ${token.color}` : ''),
        );
        if (tokenStyle) {
          nodes.push(
            createElement(
              'span',
              { key: `${key}-${lineIdx}-${tokenIdx}`, style: parseInlineStyle(tokenStyle) },
              token.content,
            ),
          );
        } else {
          nodes.push(token.content);
        }
      }
    }
    return nodes;
  } catch {
    return null;
  }
}
