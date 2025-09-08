import { createStyles } from 'antd-style';

export const useStyles = createStyles(({ css, token }) => ({
  container: css`
    position: relative;
    overflow: hidden auto;
    background: ${token.colorBgElevated};
  `,
  root: css`
    position: absolute;
    inset-block-start: -8px;
    inset-inline-start: 0;
    transform: translateY(-100%);
  `,
}));
