import { createStaticStyles } from 'antd-style';

export const styles = createStaticStyles(
  ({ css, cssVar }) => css`
    position: relative;
    overflow: visible;
    margin-block: calc(var(--lobe-markdown-margin-multiple) * 0.5em)
      calc(var(--lobe-markdown-margin-multiple) * 0.5em + 16px);

    .lobe-editor-table-scroll-wrapper {
      overflow: auto visible;
      position: relative;
      padding-top: 14px;
    }

    .toolbar,
    .toolbar-col,
    .toolbar-row {
      pointer-events: none;

      position: absolute;
      z-index: 2;
      inset-block-start: 0;
      inset-inline-start: 0;

      width: max-content;
      height: 0;
    }

    .table-controller,
    .table-controller-col,
    .table-controller-row {
      pointer-events: none;
      position: relative;
      width: max-content;
      height: 0;
    }

    .table-controller-col .top,
    .table-controller-row .left,
    .table-controller-row .corner {
      pointer-events: all;
    }

    .table-controller-row .left {
      z-index: 3;
      top: 14px;
    }

    .table-controller-row .corner {
      cursor: pointer;

      position: absolute;
      z-index: 4;
      inset-block-start: 0;
      inset-inline-start: -14px;

      box-sizing: border-box;
      width: 15px;
      height: 15px;
      border: 1px solid rgba(255, 255, 255, 12%);

      background-color: #1f1f1f;
    }

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

      background: ${cssVar.colorFillQuaternary};

      > tr:first-of-type {
        background: ${cssVar.colorFillQuaternary};

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
      border: 1px solid ${cssVar.colorFillSecondary};

      text-align: start;
      vertical-align: top;

      outline: none;
    }

    .editor_table_cell_selected {
      color: #000;
      background-color: ${cssVar.yellow};
      caret-color: transparent;
    }
  `,
);
