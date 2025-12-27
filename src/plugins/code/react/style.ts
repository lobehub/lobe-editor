import { createStaticStyles } from 'antd-style';

export const styles = createStaticStyles(({ css, cssVar }) => ({
  codeInline: css`
    display: inline;

    margin-inline: 0.25em;
    padding-block: 0.2em;
    padding-inline: 0.4em;
    border: 1px solid var(--lobe-markdown-border-color);
    border-radius: 0.25em;

    font-family: ${cssVar.fontFamilyCode};
    font-size: 0.875em;
    line-height: 1;
    word-break: break-word;
    white-space: break-spaces;

    background: ${cssVar.colorFillSecondary};
  `,
}));
