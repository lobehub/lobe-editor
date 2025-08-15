/* eslint-disable sort-keys-fix/sort-keys-fix */
import { createStyles } from 'antd-style';

export const useStyles = createStyles(({ css, token }) => ({
  placeholder: css`
    pointer-events: none;
    user-select: none;

    position: absolute;
    inset-block-start: 0;

    margin-block: 0 !important;

    color: ${token.colorTextDescription};
  `,
  placeholderContainer: css`
    transform: translateY(-2px);
  `,
}));
