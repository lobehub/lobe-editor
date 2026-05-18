import { createStaticStyles } from 'antd-style';

export const styles = createStaticStyles(({ css, cssVar }) => ({
  dragHandle: css`
    cursor: grab !important;

    &:active {
      cursor: grabbing !important;
    }
  `,
  dragIndicator: css`
    pointer-events: none;

    position: fixed;
    z-index: 10000;

    height: 2px;
    border-radius: 999px;

    background: var(--lobe-color-primary, ${cssVar.colorPrimary});
  `,
  menu: css`
    pointer-events: auto;
    position: fixed;
    z-index: 9999;
    transition:
      inset-inline-start 200ms ease,
      inset-block-start 200ms ease;
  `,
  root: css`
    padding-inline: 54px 54px;
  `,
}));
