import { createStaticStyles } from 'antd-style';

export const styles = createStaticStyles(
  ({ css, cssVar }) => css`
    cursor: pointer;

    position: relative;

    overflow: hidden;
    display: flex;
    flex-direction: column;
    align-items: center;

    width: 100%;
    margin-block: calc(var(--lobe-markdown-margin-multiple) * 0.5em);
    border-radius: var(--lobe-markdown-border-radius);

    background: ${cssVar.colorFillQuaternary};

    .cm-hidden-actions {
      opacity: 0;
      transition: opacity 0.2s ease-in-out;
    }

    .cm-language-select {
      opacity: 0.5;
      filter: grayscale(100%);
      transition:
        opacity,
        grayscale 0.2s ease-in-out;
    }

    &.selected {
      user-select: none;
    }

    &.selected::after {
      pointer-events: none;
      content: '';

      position: absolute;
      z-index: 10;
      inset: 0;

      width: 100%;
      height: 100%;

      opacity: 0.2;
      background: ${cssVar.yellow};

      transition: all 0.3s;
    }

    &.collab-locked {
      cursor: not-allowed;
    }

    &.collab-locked::after {
      pointer-events: none;
      content: '';

      position: absolute;
      z-index: 11;
      inset: 0;

      background: ${cssVar.colorFillSecondary};
    }

    &.collab-locked .cm-container {
      opacity: 0.72;
    }

    .cm-collab-lock {
      position: absolute;
      z-index: 12;
      inset-block-start: 8px;
      inset-inline-end: 8px;

      overflow: hidden;

      max-width: min(240px, calc(100% - 16px));
      padding-block: 2px;
      padding-inline: 6px;
      border-radius: 6px;

      font-size: 12px;
      line-height: 18px;
      color: ${cssVar.colorTextSecondary};
      text-overflow: ellipsis;
      white-space: nowrap;

      background: ${cssVar.colorBgElevated};
      box-shadow: ${cssVar.boxShadowTertiary};
    }

    .cm-container {
      position: relative;
      width: 100%;
      border-block-start: 1px solid ${cssVar.colorFillQuaternary};
    }

    .cm-container-collapsed {
      overflow: hidden;
      height: 0;
      border-block-start: none;
    }

    .cm-textarea {
      height: 44px;
      opacity: 0;
    }

    &:hover {
      .cm-hidden-actions {
        opacity: 1;
      }

      .cm-language-select {
        opacity: 1;
        filter: grayscale(0);
      }
    }
  `,
);
