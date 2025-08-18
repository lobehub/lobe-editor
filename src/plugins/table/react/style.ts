import { createStyles } from 'antd-style';

export const useStyles = createStyles(
  ({ css, token }) => css`
    overflow-x: auto;
    margin-block: calc(var(--lobe-markdown-margin-multiple) * 0.5em);

    .editor_table {
      table-layout: fixed;
      border-spacing: 0;
      border-collapse: collapse;

      width: fit-content;

      text-align: start;
      text-indent: initial;
      text-wrap: pretty;
      word-break: auto-phrase;
      overflow-wrap: break-word;

      background: ${token.colorFillQuaternary};

      > tr:first-of-type {
        background: ${token.colorFillQuaternary};

        .editor_table_cell_header {
          font-weight: bold;
        }
      }
    }

    code {
      word-break: break-word;
    }

    .editor_table_cell_header {
      font-weight: normal;
    }

    .editor_table_cell {
      position: relative;

      overflow: auto;

      width: 75px;
      padding-block: 6px;
      padding-inline: 8px;
      border: 1px solid ${token.colorFillSecondary};

      text-align: start;
      vertical-align: top;

      outline: none;
    }

    .editor_table_cell_selected {
      color: #000;
      background-color: ${token.yellow};
      caret-color: transparent;
    }
  `,
);
