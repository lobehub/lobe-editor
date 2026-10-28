import { createStaticStyles } from '@lobehub/ui';

export const styles = createStaticStyles(
  ({ css, cssVar }) => css`
    position: relative;
    overflow: visible;
    margin-block: calc(var(--lobe-markdown-margin-multiple) * 0.5em)
      calc(var(--lobe-markdown-margin-multiple) * 0.5em + 16px);

    .lobe-editor-table-scroll-wrapper {
      position: relative;
      overflow: auto visible;
      margin-inline: calc(
        min(var(--lobe-table-bleed, 14px), var(--lobe-block-anchor-padding, 14px)) * -1
      );
    }

    .lobe-editor-table-scroll-indicator {
      pointer-events: none;

      position: absolute;
      z-index: 3;
      inset-block: 0;

      inline-size: 24px;

      opacity: 0;

      transition: opacity 0.12s ease;
    }

    .lobe-editor-table-scroll-indicator-visible {
      opacity: 1;
    }

    .lobe-editor-table-scroll-indicator-start {
      inset-inline-start: 0;
      background: linear-gradient(
        to right,
        color-mix(in srgb, ${cssVar.colorBgContainer} 82%, transparent),
        transparent
      );
    }

    .lobe-editor-table-scroll-indicator-end {
      inset-inline-start: 0;
      background: linear-gradient(
        to left,
        color-mix(in srgb, ${cssVar.colorBgContainer} 82%, transparent),
        transparent
      );
    }

    /*
     * These hosts belong to the table controller only. Keep the selector scoped
     * to the table root / scroll wrapper so a nested editor feature using the
     * generic toolbar class (for example a LiteXML DiffNode inside a cell) is
     * not made click-through or collapsed to zero height.
     */
    > .toolbar,
    > .toolbar-col,
    > .toolbar-row,
    > .lobe-editor-table-scroll-wrapper > .toolbar-col,
    > .lobe-editor-table-scroll-wrapper > .toolbar-row {
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
      border-collapse: separate;

      width: fit-content;
      margin: 0;
      border: 1px solid ${cssVar.colorBorderSecondary};
      border-radius: 8px;

      text-align: start;
      text-indent: initial;
      text-wrap: pretty;
      word-break: auto-phrase;
      overflow-wrap: break-word;

      &[data-lobe-table-fluid] {
        width: 100%;
      }

      tr:first-of-type > .editor_table_cell_header {
        font-size: 0.8125em;
        font-weight: 500;
        color: ${cssVar.colorTextSecondary};
        background-color: ${cssVar.colorFillTertiary};
      }

      tr:last-of-type > .editor_table_cell {
        border-block-end: 0;
      }

      tr:first-of-type > .editor_table_cell:first-child {
        border-start-start-radius: 7px;
      }

      tr:first-of-type > .editor_table_cell:last-child {
        border-start-end-radius: 7px;
      }

      tr:last-of-type > .editor_table_cell:first-child {
        border-end-start-radius: 7px;
      }

      tr:last-of-type > .editor_table_cell:last-child {
        border-end-end-radius: 7px;
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
      padding-block: 10px;
      padding-inline: 14px;
      border: 0;
      border-block-end: 1px solid ${cssVar.colorBorderSecondary};

      text-align: start;
      vertical-align: top;

      outline: none;
    }

    .editor_table_cell_selected {
      background-color: color-mix(in srgb, ${cssVar.yellow} 3%, transparent);
      caret-color: transparent;
    }

    .lobe-editor-table-delete-preview {
      background-color: color-mix(in srgb, ${cssVar.colorError} 20%, transparent) !important;
    }
  `,
);

export const selectionOutlineStyles = createStaticStyles(({ css, cssVar }) => ({
  outline: css`
    pointer-events: none;

    position: fixed;
    z-index: 3;

    box-sizing: border-box;
    border: 1.5px solid color-mix(in srgb, ${cssVar.colorText} 22%, transparent);
    border-radius: 3px;
  `,
}));
