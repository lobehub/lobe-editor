import { createStaticStyles } from '@lobehub/ui';

export const styles = createStaticStyles(({ css, cssVar }) => ({
  actions: css`
    position: absolute;
    z-index: 10;
    transform: translateY(-50%);

    display: flex;
    gap: 2px;
    align-items: center;

    margin-inline-start: 6px;

    color: ${cssVar.colorTextTertiary};
  `,
}));
