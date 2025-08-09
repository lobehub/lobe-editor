/* eslint-disable sort-keys-fix/sort-keys-fix */
import { createStyles } from 'antd-style';

export const useStyles = createStyles(
  (
    { token, css },
    {
      fontSize = 16,
      headerMultiple = 1,
      marginMultiple = 2,
      lineHeight = 1.8,
    }: { fontSize?: number; headerMultiple?: number; lineHeight?: number; marginMultiple?: number },
  ) => ({
    root: css`
      --lobe-markdown-font-size: ${fontSize}px;
      --lobe-markdown-header-multiple: ${headerMultiple};
      --lobe-markdown-margin-multiple: ${marginMultiple};
      --lobe-markdown-line-height: ${lineHeight};
      --lobe-markdown-border-radius: ${token.borderRadiusLG};
      --lobe-markdown-border-color: ${token.colorFillQuaternary};

      position: relative;

      width: 100%;
      max-width: 100%;

      font-size: var(--lobe-markdown-font-size);
      line-height: var(--lobe-markdown-line-height);
      word-break: break-word;
    `,
  }),
);
