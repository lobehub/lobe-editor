import { createStyles } from 'antd-style';

export const useStyles = createStyles(
  ({ css, token }) => css`
    width: 100%;
    margin-block: calc(var(--lobe-markdown-margin-multiple) * 1.5em);
    border-color: ${token.colorBorder};
    border-style: dashed;
    border-width: 1px;
    border-block-start: none;
    border-inline-start: none;
    border-inline-end: none;
  `,
);
