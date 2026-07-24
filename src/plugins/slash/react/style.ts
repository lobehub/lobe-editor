import { createStaticStyles } from 'antd-style';

export const styles = createStaticStyles(
  ({ css, cssVar }) => css`
    background: ${cssVar.colorBgElevated};
  `,
);
