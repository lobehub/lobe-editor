import { LANGUAGES } from '@/codemirror/constants';

export const DISABLE_FORMAT_MODE = ['yaml'];

export const normalizeCodeMirrorLanguage = (value: unknown): string | null => {
  if (typeof value !== 'string') return null;
  const language = value.trim().toLocaleLowerCase();
  if (!language) return null;
  const findMode = LANGUAGES.find(
    (mode) =>
      mode.value.toLocaleLowerCase() === language ||
      mode.ext?.some((extension) => extension.toLocaleLowerCase() === language),
  );
  return findMode?.value || null;
};

export const getCodeMirrorLanguageAliases = (value: string): string[] => {
  const canonical = normalizeCodeMirrorLanguage(value);
  if (!canonical) return [];
  const findMode = LANGUAGES.find((mode) => mode.value === canonical);
  return [...new Set([canonical, ...(findMode?.ext ?? [])])];
};

export function modeMatch(mode = '') {
  const normalizedMode = normalizeCodeMirrorLanguage(mode) || 'plain';
  const findMode = LANGUAGES.find((m) => m.value === normalizedMode);

  return findMode?.value || 'plain';
}

export const LOBE_THEME = 'default';

export enum CODE_THEME_ENUM {
  LOBE = 'default',
}

export const THEMES = [
  {
    isDark: false,
    name: CODE_THEME_ENUM.LOBE,
    value: CODE_THEME_ENUM.LOBE,
  },
];

export const DEFAULT_CODEBLOCK_THEME_NAME = CODE_THEME_ENUM.LOBE;

export const DARK_CODEBLOCK_THEME_NAME = CODE_THEME_ENUM.LOBE;

export function getValidTheme(theme: string) {
  const find = THEMES.find((v) => v.value === theme || v.name === theme);
  if (find) {
    return find.value;
  }
  return DEFAULT_CODEBLOCK_THEME_NAME;
}
