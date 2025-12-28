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

    background: ${cssVar.colorFillQuaternary};

    .cm-hidden-actions {
      opacity: 0;
      transition: opacity 0.2s ease-in-out;
    }

    .cm-header-toolbar {
      border-block-end: 1px solid ${cssVar.colorFillQuaternary};
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

    .cm-container {
      position: relative;
      width: 100%;
    }

    .cm-container-collapsed {
      overflow: hidden;
      height: 0;
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
