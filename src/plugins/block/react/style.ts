import { createStaticStyles } from 'antd-style';

export const ANCHOR_PADDING_CSS_VAR = '--lobe-block-anchor-padding';

/**
 * Default inline padding (px) reserved on the editor root so the floating
 * block menu / drag handle has room to render. Exported for consumers that
 * need to align surrounding chrome (e.g. a title section above the editor)
 * with the editor's content edge.
 */
export const DEFAULT_BLOCK_ANCHOR_PADDING = 54;

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
  dragLayer: css`
    pointer-events: none;

    position: fixed;
    z-index: 10001;
    inset: 0;

    overflow: visible;
  `,
  menu: css`
    pointer-events: auto;
    position: fixed;
    z-index: 100;
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
    padding-inline: var(${ANCHOR_PADDING_CSS_VAR}, ${DEFAULT_BLOCK_ANCHOR_PADDING}px);
  `,
}));
