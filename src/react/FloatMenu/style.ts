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
  rootBottom: css`
    position: absolute;
    z-index: 9999;
    inset-block-start: 100%;
    inset-inline-start: 0;

    padding-block-start: 8px;
  `,
  rootTop: css`
    position: absolute;
    inset-block-start: -8px;
    inset-inline-start: 0;
    transform: translateY(-100%);
  `,
}));
