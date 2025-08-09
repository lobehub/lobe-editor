/* eslint-disable sort-keys-fix/sort-keys-fix */
import { createStyles } from 'antd-style';

export const useStyles = createStyles(({ css, token }) => ({
  resizer: css`
    touch-action: 'none';
    position: 'absolute';
    z-index: 1;

    @media (pointer: coarse) {
      background-color: ${token.goldBg};
      mix-blend-mode: color;
    }
  `,
}));
