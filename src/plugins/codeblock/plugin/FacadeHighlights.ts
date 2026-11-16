/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */
import type { CodeNode } from '@lexical/code-core';
import { $createCodeHighlightNode, $isCodeNode } from '@lexical/code-core';
import { LobeHighlightsTheme } from '@lobehub/ui';
import type { Lang, Theme, ThemedToken } from '@pierre/highlights';
import { codeToTokens, isSupportedLanguage } from '@pierre/highlights';
import type { LexicalEditor, LexicalNode, NodeKey } from 'lexical';
import { $createLineBreakNode, $createTabNode, $getNodeByKey } from 'lexical';

import type { INode } from '@/editor-kernel/inode';
import { INodeHelper } from '@/editor-kernel/inode/helper';

import { codeLanguages } from '../utils/languages';

const DEFAULT_THEME = 'lobe-theme';
const DIFF_LANGUAGE_REGEX = /^diff-([\w-]+)/i;
const PENDING_UPDATE_MARK = 'needUpdate';

const loadedThemes = new Map<string, Theme>([[DEFAULT_THEME, LobeHighlightsTheme]]);

function resolveLanguage(language: string): Lang | undefined {
  const diffed = DIFF_LANGUAGE_REGEX.exec(language);
  const id = (diffed ? diffed[1] : language).toLowerCase();
  if (isSupportedLanguage(id)) return id;
  const info = codeLanguages.find((lang) => lang.id === id || lang.aliases?.includes(id));
  return info?.aliases?.find((alias) => isSupportedLanguage(alias));
}

export function isCodeLanguageSupported(language: string) {
  return resolveLanguage(language) !== undefined;
}

function parseThemes(theme: string) {
  return theme.split(' ').filter((id) => id && id !== PENDING_UPDATE_MARK);
}

export function isCodeThemeLoaded(theme: string) {
  return parseThemes(theme).every((id) => loadedThemes.has(id));
}

async function loadTheme(id: string) {
  const { themes } = await import('@pierre/highlights/themes/loader');
  const loaded = await themes[id]?.().catch(() => undefined);
  loadedThemes.set(id, loaded?.default ?? LobeHighlightsTheme);
}

export async function loadCodeTheme(theme: string, editor?: LexicalEditor, codeNodeKey?: NodeKey) {
  await Promise.all(
    parseThemes(theme)
      .filter((id) => !loadedThemes.has(id))
      .map((id) => loadTheme(id)),
  );
  if (editor && codeNodeKey) {
    editor.update(() => {
      const codeNode = $getNodeByKey(codeNodeKey);
      if ($isCodeNode(codeNode)) {
        codeNode.markDirty();
      }
    });
  }
}

function tokenize(code: string, language: string, theme: string): ThemedToken[][] {
  const [light = DEFAULT_THEME, dark] = parseThemes(theme);
  const lang: Lang = resolveLanguage(language) ?? 'text';
  const getTheme = (id: string) => loadedThemes.get(id) ?? LobeHighlightsTheme;

  if (!dark) return codeToTokens(code, { lang, theme: getTheme(light) }).tokens;

  return codeToTokens(code, {
    // Saved documents already carry `--shiki-light` / `--shiki-dark` token styles.
    cssVariablePrefix: '--shiki-',
    defaultColor: false,
    lang,
    themes: { dark: getTheme(dark), light: getTheme(light) },
  }).tokens;
}

function getTokenStyle(token: ThemedToken): string {
  if (token.htmlStyle) {
    return Object.entries(token.htmlStyle)
      .map(([key, value]) => `${key}:${value}`)
      .join(';');
  }
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
          node.style = getTokenStyle(token);
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
          node.setStyle(getTokenStyle(token));
          nodes.push(node);
        }
      });
    });
  });

  return nodes;
}

export function getHighlightSerializeNode(
  code: string,
  language: string,
  theme = DEFAULT_THEME,
): INode[] {
  const tokens = tokenize(code, language, theme);
  return mapTokensToLexicalSerialized(tokens, DIFF_LANGUAGE_REGEX.test(language));
}

export function $getHighlightNodes(codeNode: CodeNode, language: string): LexicalNode[] {
  const tokens = tokenize(
    codeNode.getTextContent(),
    language,
    codeNode.getTheme() || DEFAULT_THEME,
  );
  return mapTokensToLexicalStructure(tokens, DIFF_LANGUAGE_REGEX.test(language));
}
