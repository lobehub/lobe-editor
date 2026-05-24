import { createStaticStyles } from 'antd-style';

export const styles = createStaticStyles(
  ({ css, cssVar }) => css`
    position: relative;
    overflow: visible;
    margin-block: calc(var(--lobe-markdown-margin-multiple) * 0.5em)
      calc(var(--lobe-markdown-margin-multiple) * 0.5em + 16px);

    .lobe-editor-table-scroll-wrapper {
      position: relative;
      overflow: auto visible;
      padding-block-start: 14px;
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

    .lobe-editor-table-delete-preview {
      background-color: color-mix(in srgb, ${cssVar.colorError} 20%, transparent) !important;
    }
  `,
);
