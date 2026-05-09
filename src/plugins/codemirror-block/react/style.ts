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

    background: ${cssVar.colorFillTertiary};

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

    /* 深色模式下代码高亮颜色更柔和 */
    @media (prefers-color-scheme: dark) {
      background: ${cssVar.colorFillQuaternary};

      .cm-line {
        & .cm-atom,
        & .cm-attribute {
          color: ${cssVar.purple7};
        }

        & .cm-builtin,
        & .cm-number,
        & .cm-property,
        & .cm-tag {
          color: ${cssVar.volcano7};
        }

        & .cm-function,
        & .cm-keyword,
        & .cm-modifier,
        & .cm-operator,
        & .cm-punctuation,
        & .cm-tag.cm-bracket,
        & .cm-variable-2,
        & .cm-variable.cm-callee {
          color: ${cssVar.geekblue7};
        }

        & .cm-qualifier,
        & .cm-type,
        & .cm-variable-3 {
          color: ${cssVar.gold7};
        }

        & .cm-string,
        & .cm-string-2 {
          color: ${cssVar.green7};
        }
      }

      .cm-gutters {
        background-color: ${cssVar.colorBgElevated} !important;
      }

      .cm-focused > .cm-scroller > .cm-selectionLayer .cm-selectionBackground {
        background: ${cssVar.cyan6} !important;
      }

      .cm-foldPlaceholder {
        background: url("data:image/svg+xml,%3Csvg width='16' height='16' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Crect fill='%232A3238' width='16' height='16' rx='2'/%3E%3Cpath d='M2.75 7.984a.875.875 0 1 0 1.75 0 .875.875 0 0 0-1.75 0Zm4.375 0a.875.875 0 1 0 1.75 0 .875.875 0 0 0-1.75 0Zm4.375 0a.875.875 0 1 0 1.75 0 .875.875 0 0 0-1.75 0Z' fill='%238C8C8C'/%3E%3C/g%3E%3C/svg%3E")
          no-repeat !important;
      }
    }
  `,
);
