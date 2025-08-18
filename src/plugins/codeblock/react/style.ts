import { createStyles } from 'antd-style';

import { AllColorReplacements } from '@/plugins/codeblock/plugin/FacadeShiki';

export const useStyles = createStyles(({ css, token, stylish, isDarkMode }) => ({
  code: css`
    --color-yellow: ${token.yellow};
    --color-error: ${token.colorError};
    --color-gray: ${token.gray};
    --color-purple: ${token.purple10};
    --color-info: ${token.colorInfo};
    --color-success: ${token.colorSuccess};
    --color-warning: ${token.colorWarning};
    --color-text: ${token.colorText};
    --color-geekblue: ${token.geekblue};
    --color-purple10: ${token.purple10};
    --color-warning-text-active: ${token.colorWarningTextActive};
    --color-yellow11: ${token.yellow11};

    position: relative;

    overflow: hidden;
    display: block;

    width: 100%;
    margin-block: calc(var(--lobe-markdown-margin-multiple) * 0.5em);
    padding: 16px;
    border-radius: calc(var(--lobe-markdown-border-radius) * 1px);

    font-family: ${token.fontFamilyCode};
    font-size: calc(var(--lobe-markdown-font-size) * 0.85);

    background: ${token.colorFillTertiary} !important;
    box-shadow: 0 0 0 1px var(--lobe-markdown-border-color) inset;

    &::after {
      border-radius: ${token.borderRadius}px;

      content: attr(data-language);

      padding-block: 1px;
      padding-inline: 7px;

      font-size: 12px;

      display: block;

      position: absolute;
      z-index: 3;
      inset-block-end: 8px;
      inset-inline-end: 8px;

      font-family: ${token.fontFamilyCode};
      color: ${token.colorTextSecondary};

      background: ${token.colorFillQuaternary};

      transition: opacity 0.1s;

      opacity: 0;

      ${stylish.blur}
    }

    span {
      color: var(${isDarkMode ? '--shiki-dark' : '--shiki-light'});
    }

    &:hover {
      &::after {
        opacity: 1;
      }
    }
  `,
  noBackground: css`
    background: transparent !important;
  `,
}));

export const colorReplacements: AllColorReplacements = {
  'slack-dark': {
    '#4ec9b0': 'var(--color-yellow)',
    '#569cd6': 'var(--color-error)',
    '#6a9955': 'var(--color-gray)',
    '#9cdcfe': 'var(--color-text)',
    '#b5cea8': 'var(--color-purple10)',
    '#c586c0': 'var(--color-info)',
    '#ce9178': 'var(--color-success)',
    '#dcdcaa': 'var(--color-warning)',
    '#e6e6e6': 'var(--color-text)',
  },
  'slack-ochin': {
    '#002339': 'var(--color-text)',
    '#0444ac': 'var(--color-geekblue)',
    '#0991b6': 'var(--color-error)',
    '#174781': 'var(--color-purple10)',
    '#2f86d2': 'var(--color-text)',
    '#357b42': 'var(--color-gray)',
    '#7b30d0': 'var(--color-info)',
    '#7eb233': 'var(--color-warning-text-active)',
    '#a44185': 'var(--color-success)',
    '#dc3eb7': 'var(--color-yellow11)',
  },
};
