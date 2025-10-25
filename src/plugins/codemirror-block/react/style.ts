import { createStyles } from 'antd-style';

export const useStyles = createStyles(
  ({ css, token }) => css`
    cursor: pointer;

    display: flex;
    flex-direction: row;
    align-items: center;
    width: 100%;

    .cm-editor {
      width: 100%;
      border-color: ${token.colorBorder};
      border-style: dashed;
      border-width: 1px;
      border-block-start: none;
      border-inline-start: none;
      border-inline-end: none;
    }

    &.selected {
      background: ${token.yellow};

      hr {
        border-color: #000;
      }
    }
  `,
);
