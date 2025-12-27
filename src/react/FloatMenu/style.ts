import { createStaticStyles } from 'antd-style';

export const styles = createStaticStyles(({ css, cssVar }) => ({
  container: css`
    position: relative;
    overflow: hidden auto;
    background: ${cssVar.colorBgElevated};
  `,
  containerWithMaxHeight: css`
    /* maxHeight is set via inline style as it's dynamic */
  `,
  root: css`
    position: absolute;
    inset-block-start: -8px;
    inset-inline-start: 0;
    transform: translateY(-100%);
  `,
}));
