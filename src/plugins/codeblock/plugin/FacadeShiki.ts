/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */
import type { CodeNode } from '@lexical/code';
import { $createCodeHighlightNode, $isCodeNode } from '@lexical/code';
import { ShikiLobeTheme } from '@lobehub/ui';
import {
  createHighlighterCoreSync,
  isSpecialLang,
  isSpecialTheme,
  stringifyTokenStyle,
} from '@shikijs/core';
import { createJavaScriptRegexEngine } from '@shikijs/engine-javascript';
import type { ThemedToken, TokensResult } from '@shikijs/types';
import type { LexicalEditor, LexicalNode, NodeKey, SerializedTextNode, Spread } from 'lexical';
import { $createLineBreakNode, $createTabNode, $getNodeByKey } from 'lexical';
import { bundledLanguagesInfo, bundledThemesInfo } from 'shiki';

import { INode } from '@/editor-kernel/inode';
import { INodeHelper } from '@/editor-kernel/inode/helper';

// Color replacements types for Shiki
export type ColorReplacements = Record<string, string>;
export type ScopedColorReplacements = Record<string, ColorReplacements>;
export type AllColorReplacements = ColorReplacements | ScopedColorReplacements;

export type SerializedCodeHighlightNode = Spread<
  {
    highlightType: string | null | undefined;
  },
  SerializedTextNode
>;

const shiki = createHighlighterCoreSync({
  engine: createJavaScriptRegexEngine(),
  langs: [],
  themes: [],
});

// Load ShikiLobeTheme immediately after initialization
shiki.loadTheme(ShikiLobeTheme as any);

function getDiffedLanguage(language: string) {
  const DIFF_LANGUAGE_REGEX = /^diff-([\w-]+)/i;
  const diffLanguageMatch = DIFF_LANGUAGE_REGEX.exec(language);
  return diffLanguageMatch ? diffLanguageMatch[1] : null;
}

/**
 * Creates a simple color replacement map
 * @param replacements - Object mapping from old color to new color
 * @returns ColorReplacements object
 */
export function createColorReplacements(replacements: Record<string, string>): ColorReplacements {
  return replacements;
}

/**
 * Creates scoped color replacements for multiple themes
 * @param scopedReplacements - Object mapping theme names to their color replacements
 * @returns ScopedColorReplacements object
 */
export function createScopedColorReplacements(
  scopedReplacements: Record<string, Record<string, string>>,
): ScopedColorReplacements {
  return scopedReplacements;
}

/**
 * Validates that a color value is a valid CSS color
 * @param color - The color string to validate
 * @returns true if the color is valid
 */
export function isValidColor(color: string): boolean {
  // Basic validation for common color formats
  const hexColorRegex = /^#[\dA-Fa-f]{3,8}$/;
  const rgbColorRegex = /^rgb\((?:\s*\d+\s*,){2}\s*\d+\s*\)$/;
  const rgbaColorRegex = /^rgba\((?:\s*\d+\s*,){3}\s*[\d.]+\s*\)$/;
  const hslColorRegex = /^hsl\(\s*\d+(?:\s*,\s*\d+%){2}\s*\)$/;
  const hslaColorRegex = /^hsla\(\s*\d+(?:\s*,\s*\d+%){2}\s*,\s*[\d.]+\s*\)$/;
  const cssVariableRegex = /^var\(--[\w-]+\)$/;

  return (
    hexColorRegex.test(color) ||
    rgbColorRegex.test(color) ||
    rgbaColorRegex.test(color) ||
    hslColorRegex.test(color) ||
    hslaColorRegex.test(color) ||
    cssVariableRegex.test(color)
  );
}

export function isCodeLanguageLoaded(language: string) {
  const diffedLanguage = getDiffedLanguage(language);
  const langId = diffedLanguage || language;

  // handle shiki Hard-coded languages ['ansi', '', 'plaintext', 'txt', 'text', 'plain']
  if (isSpecialLang(langId)) {
    return true;
  }

  // note: getLoadedLanguages() also returns aliases
  return shiki.getLoadedLanguages().includes(langId);
}

export function loadCodeLanguage(language: string, editor?: LexicalEditor, codeNodeKey?: NodeKey) {
  const diffedLanguage = getDiffedLanguage(language);
  const langId = diffedLanguage ? diffedLanguage : language;
  if (!isCodeLanguageLoaded(langId)) {
    const languageInfo = bundledLanguagesInfo.find(
      (desc) => desc.id === langId || (desc.aliases && desc.aliases.includes(langId)),
    );
    if (languageInfo) {
      // in case we arrive here concurrently (not yet loaded language is loaded twice)
      // shiki's synchronous checks make sure to load it only once
      shiki.loadLanguage(languageInfo.import()).then(() => {
        // here we know that the language is loaded
        // make sure the code is highlighed with the correct language
        if (editor && codeNodeKey) {
          editor.update(() => {
            const codeNode = $getNodeByKey(codeNodeKey);
            if (
              $isCodeNode(codeNode) &&
              codeNode.getLanguage() === language &&
              !codeNode.getIsSyntaxHighlightSupported()
            ) {
              codeNode.setIsSyntaxHighlightSupported(true);
            }
          });
        }
      });
    }
  }
}

function _isCodeThemeLoaded(theme: string) {
  const themeId = theme;

  // handle shiki special theme ['none']
  if (isSpecialTheme(themeId)) {
    return true;
  }

  return shiki.getLoadedThemes().includes(themeId);
}

export function isCodeThemeLoaded(theme: string) {
  const themes = theme.split(' ');
  return themes.every((t) => _isCodeThemeLoaded(t));
}

async function _loadCodeTheme(theme: string, editor?: LexicalEditor, codeNodeKey?: NodeKey) {
  if (!isCodeThemeLoaded(theme)) {
    // Handle lobe-theme from @lobehub/ui
    if (theme === 'lobe-theme') {
      // ShikiLobeTheme is already loaded in shiki instance initialization
      if (editor && codeNodeKey) {
        editor.update(() => {
          const codeNode = $getNodeByKey(codeNodeKey);
          if ($isCodeNode(codeNode)) {
            codeNode.markDirty();
          }
        });
      }
      return;
    }

    const themeInfo = bundledThemesInfo.find((info) => info.id === theme);
    if (themeInfo) {
      shiki.loadTheme(themeInfo.import()).then(() => {
        if (editor && codeNodeKey) {
          editor.update(() => {
            const codeNode = $getNodeByKey(codeNodeKey);
            if ($isCodeNode(codeNode)) {
              codeNode.markDirty();
            }
          });
        }
      });
    }
  }
}

export async function loadCodeTheme(theme: string, editor?: LexicalEditor, codeNodeKey?: NodeKey) {
  const themes = theme.split(' ');
  await Promise.all(themes.map((t) => _loadCodeTheme(t, editor, codeNodeKey)));
}

export function getCodeLanguageOptions(): [string, string][] {
  return bundledLanguagesInfo.map((i) => [i.id, i.name]);
}
export function getCodeThemeOptions(): [string, string][] {
  return bundledThemesInfo.map((i) => [i.id, i.displayName]);
}

export function normalizeCodeLanguage(language: string): string {
  const langId = language;
  const languageInfo = bundledLanguagesInfo.find(
    (desc) => desc.id === langId || (desc.aliases && desc.aliases.includes(langId)),
  );
  if (languageInfo) {
    return languageInfo.id;
  }
  return language;
}

function getTokenStyleObject(token: ThemedToken): string {
  let style = '';
  if (token.color) {
    style += `color: ${token.color};`;
  }
  if (token.bgColor) {
    style += `background-color: ${token.bgColor};`;
  }
  return style;
}

function mapTokensToLexicalSerialized(tokens: ThemedToken[][], diff: boolean): INode[] {
  const nodes: INode[] = [];

  tokens.forEach((line, idx) => {
    if (idx) {
      nodes.push({
        type: 'linebreak',
        version: 1,
      });
    }
    line.forEach((token, tidx) => {
      let text = token.content;

      // implement diff-xxxx languages
      if (diff && tidx === 0 && text.length > 0) {
        const prefixes = ['+', '-', '>', '<', ' '];
        const prefixTypes = ['inserted', 'deleted', 'inserted', 'deleted', 'unchanged'];
        const prefixIndex = prefixes.indexOf(text[0]);
        if (prefixIndex !== -1) {
          nodes.push(
            INodeHelper.createLikeTextNode('code-highlight', prefixes[prefixIndex], {
              highlightType: prefixTypes[prefixIndex],
            }),
          );
          text = text.slice(1);
        }
      }

      const parts = text.split('\t');
      parts.forEach((part: string, pidx: number) => {
        if (pidx) {
          nodes.push(INodeHelper.createLikeTextNode('tab', '\t'));
        }
        if (part !== '') {
          const node = INodeHelper.createLikeTextNode('code-highlight', part);
          const style = stringifyTokenStyle(token.htmlStyle || getTokenStyleObject(token));
          node.style = style;
          nodes.push(node);
        }
      });
    });
  });

  return nodes;
}

function mapTokensToLexicalStructure(tokens: ThemedToken[][], diff: boolean): LexicalNode[] {
  const nodes: LexicalNode[] = [];

  tokens.forEach((line, idx) => {
    if (idx) {
      nodes.push($createLineBreakNode());
    }
    line.forEach((token, tidx) => {
      let text = token.content;

      // implement diff-xxxx languages
      if (diff && tidx === 0 && text.length > 0) {
        const prefixes = ['+', '-', '>', '<', ' '];
        const prefixTypes = ['inserted', 'deleted', 'inserted', 'deleted', 'unchanged'];
        const prefixIndex = prefixes.indexOf(text[0]);
        if (prefixIndex !== -1) {
          nodes.push($createCodeHighlightNode(prefixes[prefixIndex], prefixTypes[prefixIndex]));
          text = text.slice(1);
        }
      }

      const parts = text.split('\t');
      parts.forEach((part: string, pidx: number) => {
        if (pidx) {
          nodes.push($createTabNode());
        }
        if (part !== '') {
          const node = $createCodeHighlightNode(part);
          const style = stringifyTokenStyle(token.htmlStyle || getTokenStyleObject(token));
          node.setStyle(style);
          nodes.push(node);
        }
      });
    });
  });

  return nodes;
}

const DIFF_LANGUAGE_REGEX = /^diff-([\w-]+)/i;

export function getHighlightSerializeNode(
  code: string,
  language: string,
  theme = 'lobe-theme',
): INode[] {
  // Implementation goes here

  const diffLanguageMatch = DIFF_LANGUAGE_REGEX.exec(language);

  const themes = theme.split(' ');

  // Build the options for codeToTokens
  const options: any =
    themes.length > 1
      ? {
          defaultColor: false,
          lang: diffLanguageMatch ? diffLanguageMatch[1] : language,
          themes: {
            dark: themes[1],
            light: themes[0],
          },
        }
      : {
          lang: language,
          theme: themes[0],
        };

  const tokensResult: TokensResult = shiki.codeToTokens(code, options);

  const { tokens } = tokensResult;

  return mapTokensToLexicalSerialized(tokens, !!diffLanguageMatch);
}

export function $getHighlightNodes(codeNode: CodeNode, language: string): LexicalNode[] {
  const diffLanguageMatch = DIFF_LANGUAGE_REGEX.exec(language);
  const code: string = codeNode.getTextContent();
  const theme = codeNode.getTheme() || 'lobe-theme';

  const themes = theme.split(' ');

  // Build the options for codeToTokens
  const options: any =
    themes.length > 1
      ? {
          defaultColor: false,
          lang: diffLanguageMatch ? diffLanguageMatch[1] : language,
          themes: {
            dark: themes[1],
            light: themes[0],
          },
        }
      : {
          lang: language,
          theme: themes[0],
        };

  const tokensResult: TokensResult = shiki.codeToTokens(code, options);

  const { tokens } = tokensResult;
  // let style = '';
  // if (bg) {
  //   style += `background-color: ${bg};`;
  // }
  // if (fg) {
  //   style += `color: ${fg};`;
  // }
  // if (codeNode.getStyle() !== style) {
  //   codeNode.setStyle(style);
  // }
  return mapTokensToLexicalStructure(tokens, !!diffLanguageMatch);
}

/**
 * Extended version of $getHighlightNodes with additional options
 * @param codeNode - The CodeNode to highlight
 * @param language - The programming language
 * @param options - Additional highlighting options
 */
export interface HighlightOptions {
  theme?: string;
}

export function $getHighlightNodesWithOptions(
  codeNode: CodeNode,
  language: string,
  options?: HighlightOptions,
): LexicalNode[] {
  // If theme is provided in options, temporarily override the CodeNode's theme
  const originalGetTheme = codeNode.getTheme;
  if (options?.theme) {
    codeNode.getTheme = () => options.theme!;
  }

  try {
    return $getHighlightNodes(codeNode, language);
  } finally {
    // Restore original getTheme method
    if (options?.theme) {
      codeNode.getTheme = originalGetTheme;
    }
  }
}
