/* eslint-disable sort-keys-fix/sort-keys-fix */
import { createStyles } from 'antd-style';

export const useThemeStyles = createStyles(({ css, token }) => ({
  textBold: css`
    font-weight: bold;
  `,
  textItalic: css`
    font-style: italic;
  `,
  textUnderline: css`
    text-decoration: underline;
  `,
  textStrikethrough: css`
    text-decoration: line-through;
  `,
  textUnderlineStrikethrough: css`
    text-decoration: underline line-through;
  `,
  textCode: css`
    display: inline;

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
  `,
  quote: css`
    margin-block: calc(var(--lobe-markdown-margin-multiple) * 0.5em);
    margin-inline: 0;
    padding-block: 0;
    padding-inline: 1em;
    border-inline-start: solid 4px ${token.colorBorder};

    color: ${token.colorTextSecondary};
  `,
}));
