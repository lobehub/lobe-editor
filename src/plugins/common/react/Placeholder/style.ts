/* eslint-disable sort-keys-fix/sort-keys-fix */
import { createStyles } from 'antd-style';

export const useStyles = createStyles(({ css, token }) => ({
  placeholder: css`
    pointer-events: none;
    user-select: none;

    inset-block-start: 0;

    margin-block: 4px;

    font-size: var(--lobe-markdown-font-size);
    line-height: var(--lobe-markdown-line-height);
    color: ${token.colorTextDescription};
  `,
  placeholderContainer: css`
    transform: translateY(-2px);
  `,
}));
