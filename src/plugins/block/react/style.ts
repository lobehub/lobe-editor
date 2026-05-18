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
    z-index: 100;
    transition:
      inset-inline-start 200ms ease,
      inset-block-start 200ms ease;
  `,
  menuInner: css`
    display: flex;
    gap: 4px;
    align-items: center;

    min-width: 28px;
    min-height: 28px;
    padding: 2px;
    border-radius: 8px;

    background: transparent;
    box-shadow: none;

    transition:
      background 120ms ease,
      box-shadow 120ms ease;

    &:hover {
      background: var(--lobe-color-fill-secondary, ${cssVar.colorFillSecondary});
      box-shadow: 0 0 0 1px ${cssVar.colorBorderSecondary} inset;
    }
  `,
  root: css`
    padding-inline: 54px 54px;
  `,
}));
