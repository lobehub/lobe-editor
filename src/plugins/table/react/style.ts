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
      margin-inline: calc(var(--lobe-block-anchor-padding, 54px) * -1);
      padding-block-start: 14px;
    }

    /*
     * Standalone/legacy tables keep the anchor-padding bleed above. Once the
     * viewport is mounted inside a Hole, the Hole slot is the complete visual
     * boundary: both the scrollport and table start/end margins must collapse
     * to it so the boundary caret remains outside the grid at every scroll
     * position.
     */
    .lobe-editor-table-scroll-wrapper[data-hole-table-viewport] {
      margin-inline: 0;
    }

    .lobe-editor-table-scroll-wrapper[data-hole-table-viewport] > table.editor_table {
      margin-inline: 0;
    }

    .lobe-editor-table-scroll-indicator {
      pointer-events: none;

      position: absolute;
      z-index: 3;
      inset-block: 14px 0;

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

    > .toolbar-col,
    > .lobe-editor-table-scroll-wrapper > .toolbar-col,
    > .lobe-editor-table-scroll-wrapper > .toolbar-row {
      inset-inline-start: var(--lobe-block-anchor-padding, 54px);
    }

    .lobe-editor-table-scroll-wrapper[data-hole-table-viewport] > .toolbar-col,
    .lobe-editor-table-scroll-wrapper[data-hole-table-viewport] > .toolbar-row,
    > .toolbar-row[data-hole-table-overlay] {
      inset-inline-start: 0;
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
      margin-inline: var(--lobe-block-anchor-padding, 54px);

      text-align: start;
      text-indent: initial;
      text-wrap: pretty;
      word-break: auto-phrase;
      overflow-wrap: break-word;

      > tr:first-of-type {
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
      caret-color: transparent;

      &::after {
        pointer-events: none;
        content: '';

        position: absolute;
        z-index: 1;
        inset: 1px;

        background: color-mix(in srgb, ${cssVar.yellow} 12%, transparent);
      }

      &::selection,
      *::selection {
        color: inherit;
        background: transparent;
      }
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
