import { createStaticStyles } from '@lobehub/ui';

export const styles = createStaticStyles(
  ({ css, cssVar }) => css`
    background: ${cssVar.colorBgElevated};
  `,
);
