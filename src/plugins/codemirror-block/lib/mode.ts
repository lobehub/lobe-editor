import { LANGUAGES } from '@/codemirror/constants';

export const DISABLE_FORMAT_MODE = ['yaml'];

export function modeMatch(mode = '') {
  // eslint-disable-next-line no-param-reassign
  mode = mode.toLocaleLowerCase() || 'plain';
  const findMode = LANGUAGES.find((m) => m.value === mode || m.ext?.includes(mode));

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
