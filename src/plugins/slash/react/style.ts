/* eslint-disable sort-keys-fix/sort-keys-fix */
import { createStaticStyles } from 'antd-style';

export const styles = createStaticStyles(
  ({ css, cssVar }) => css`
    background: ${cssVar.colorBgElevated};
  `,
);
