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

    &:has(.cm-mermaid-preview) {
      overflow: visible;
    }

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

    .cm-mermaid-preview {
      overflow: visible;
      align-self: stretch;

      width: 100%;
      padding-block-end: 8px;
      padding-inline: 12px;
      border-block-start: 1px solid ${cssVar.colorFillQuaternary};
    }

    .cm-mermaid-chart-area {
      cursor: zoom-in;

      overflow: visible;

      width: 100%;
      min-height: 120px;
      border-radius: ${cssVar.borderRadius}px;

      &:has(.cm-mermaid-render-expanded) {
        cursor: zoom-out;
      }
    }

    .cm-mermaid-render {
      overflow: auto;
      overflow-x: auto;
      width: 100%;

      /* 过小会被裁得像「不全」：略放大默认视窗，内部仍可滚动兜底超高/超宽 */
      max-height: min(480px, 55vh);

      img {
        max-width: 100%;
        height: auto;
      }

      svg {
        height: auto;
      }

      &:not(.cm-mermaid-render-expanded) svg {
        max-width: 100%;
      }

      &.cm-mermaid-render-expanded {
        max-height: min(92vh, 1200px);

        svg {
          max-width: none;
        }
      }
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
