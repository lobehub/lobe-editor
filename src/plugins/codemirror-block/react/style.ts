import { createStyles } from 'antd-style';

export const useStyles = createStyles(
  ({ css, token, isDarkMode }) => css`
    cursor: pointer;

    position: relative;

    overflow: hidden;
    display: flex;
    flex-direction: column;
    align-items: center;

    width: 100%;
    border-start-start-radius: ${token.borderRadius}px;
    border-start-end-radius: ${token.borderRadius}px;

    .toolbar {
      display: flex;
      align-items: center;
      justify-content: space-between;

      width: 100%;
      padding-block: 8px;
      padding-inline: 12px;
      border-block-end: 1px solid #363b45ff;

      background-color: #272c35;
    }

    .cm-editor {
      width: 100%;
      border-color: ${token.colorBorder};
      border-style: dashed;
      border-width: 1px;
      border-block-start: none;
      border-inline-start: none;
      border-inline-end: none;
    }

    .cm-cursor.cm-cursor-primary {
      border-inline-start: 2px solid ${token.colorPrimary} !important;
    }

    .cm-selectionBackground {
      background: transparent;
    }

    .ͼ3.cm-focused > .cm-scroller > .cm-selectionLayer .cm-selectionBackground {
      background: ${isDarkMode ? token.yellow : token.colorBgContainer};
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
      background: ${token.yellow};

      transition: all 0.3s;
    }
  `,
);
