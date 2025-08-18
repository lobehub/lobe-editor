/* eslint-disable sort-keys-fix/sort-keys-fix */
import { createStyles } from 'antd-style';

export const useStyles = createStyles(({ css, token }) => ({
  file: css`
    user-select: none;

    display: inline-block;

    margin-inline: 0.25em;
    padding-block: 0.2em;
    padding-inline: 0.4em;
    border: 1px solid var(--lobe-markdown-border-color);
    border-radius: 0.25em;

    font-family: ${token.fontFamilyCode};
    font-size: 0.875em;
    line-height: 1;
    word-break: break-word;
    white-space: break-spaces;

    background: ${token.colorFillSecondary};

    span {
      user-select: none;
    }

    &.selected {
      color: #000;
      background: ${token.yellow};
    }
  `,
}));
