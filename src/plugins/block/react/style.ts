import { createStaticStyles } from 'antd-style';

export const styles = createStaticStyles(({ css }) => ({
  dragHandle: css`
    cursor: grab;

    display: inline-flex;
    align-items: center;
    justify-content: center;

    width: 24px;
    height: 24px;
    border: 1px solid transparent;
    border-radius: 8px;

    color: var(--lobe-color-text-secondary, rgba(0, 0, 0, 50%));

    background: transparent;

    &:hover {
      border-color: var(--lobe-markdown-border-color, rgba(120, 120, 120, 28%));
      color: var(--lobe-color-text, rgba(0, 0, 0, 88%));
      background: var(--lobe-color-fill, rgba(120, 120, 120, 12%));
    }

    &:active {
      cursor: grabbing;
    }
  `,
  dragIndicator: css`
    pointer-events: none;

    position: fixed;
    z-index: 10000;

    height: 2px;
    border-radius: 999px;

    background: var(--lobe-color-primary, #1677ff);
  `,
  menu: css`
    pointer-events: auto;
    position: fixed;
    z-index: 9999;
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

    background: var(--lobe-color-fill-secondary, rgba(255, 255, 255, 90%));
    box-shadow: 0 0 0 1px var(--lobe-markdown-border-color, rgba(120, 120, 120, 35%)) inset;
  `,
  operationMenu: css`
    position: fixed;
    z-index: 10001;

    min-width: 120px;
    padding: 4px;
    border-radius: 8px;

    background: var(--lobe-color-fill-secondary, rgba(255, 255, 255, 98%));
    box-shadow: 0 6px 18px rgba(0, 0, 0, 15%);
  `,
  operationMenuItem: css`
    cursor: pointer;

    width: 100%;
    padding-block: 6px;
    padding-inline: 8px;
    border: 0;
    border-radius: 6px;

    font-size: 12px;
    color: inherit;
    text-align: start;

    background: transparent;

    &:hover {
      background: var(--lobe-color-fill-tertiary, rgba(120, 120, 120, 14%));
    }
  `,
  root: css`
    padding-inline: 54px 54px;
  `,
}));
