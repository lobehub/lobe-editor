import { createStaticStyles } from 'antd-style';

export const styles = createStaticStyles(
  ({ css, cssVar }) => css`
    position: relative;

    /*
     * Tables have a generic toolbar rule for their row/column controllers.
     * It intentionally turns pointer events off and creates a low stacking
     * layer. A DiffNode rendered inside a table cell also uses that class, so without
     * the direct-child selector the table rule wins in the composed Page UI:
     * the visible approval buttons are covered by the content layer and cannot be
     * clicked.
     */
    & > .toolbar {
      pointer-events: auto;

      position: absolute;
      z-index: 10002;
      inset-block-end: 0;
      inset-inline-end: 8px;

      width: auto;
      height: auto;

      opacity: 0;
    }

    &:hover {
      & > .toolbar {
        opacity: 1;
      }
    }

    &[data-diff-type='add'] .content {
      position: relative;
      margin-block-start: calc(var(--lobe-markdown-margin-multiple) * 0.5em);
      padding-inline-end: 4px;
      border-inline-end: 3px solid ${cssVar.colorSuccess};
    }

    &[data-diff-type='remove'] .content {
      position: relative;
      margin-block-start: calc(var(--lobe-markdown-margin-multiple) * 0.5em);
      padding-inline-end: 4px;
      border-inline-end: 3px solid ${cssVar.colorError};

      > *:first-child * {
        color: ${cssVar.colorTextQuaternary} !important;
        text-decoration: line-through !important;
      }
    }

    &[data-diff-type='listItemRemove'] {
      display: inline-block;
      min-width: 100%;
    }

    &[data-diff-type='listItemRemove'] .content {
      position: relative;
      margin-block-start: calc(var(--lobe-markdown-margin-multiple) * 0.5em);
      padding-inline-end: 4px;
      border-inline-end: 3px solid ${cssVar.colorError};

      /* first child: original (deleted) */

      /*  > *:first-child {}  */

      /* visually indicate deletion with strike-through for text nodes */
      > *:first-child * {
        color: ${cssVar.colorTextQuaternary} !important;
        text-decoration: line-through !important;
      }

      /* second child: modified/new - normal appearance */
      > *:nth-child(2) {
        color: inherit;
        opacity: 1;
      }
    }

    &[data-diff-type='listItemModify'] {
      display: inline-block;
      min-width: 100%;

      p {
        display: block !important;
      }
    }

    &[data-diff-type='listItemModify'] .content {
      position: relative;
      margin-block-start: calc(var(--lobe-markdown-margin-multiple) * 0.5em);
      padding-inline-end: 4px;
      border-inline-end: 3px solid ${cssVar.colorWarning};

      /* first child: original (deleted) */

      /*  > *:first-child {}  */

      /* visually indicate deletion with strike-through for text nodes */
      > *:first-child * {
        color: ${cssVar.colorTextQuaternary} !important;
        text-decoration: line-through !important;
      }

      /* second child: modified/new - normal appearance */
      > *:nth-child(2) {
        color: inherit;
        opacity: 1;
      }
    }

    &[data-diff-type='modify'] .content {
      position: relative;
      margin-block-start: calc(var(--lobe-markdown-margin-multiple) * 0.5em);
      padding-inline-end: 4px;
      border-inline-end: 3px solid ${cssVar.colorWarning};

      /* first child: original (deleted) */

      /*  > *:first-child {}  */

      /* visually indicate deletion with strike-through for text nodes */
      > *:first-child * {
        color: ${cssVar.colorTextQuaternary} !important;
        text-decoration: line-through !important;
      }

      /* second child: modified/new - normal appearance */
      > *:nth-child(2) {
        color: inherit;
        opacity: 1;
      }
    }
  `,
);

export const tableRowDiffStyles = createStaticStyles(
  ({ css, cssVar }) => css`
    &[data-diff-type='remove'] {
      color: ${cssVar.colorTextQuaternary};
      text-decoration: line-through;
      background: ${cssVar.colorErrorBg};
    }

    &[data-diff-type='add'] {
      background: ${cssVar.colorSuccessBg};
      box-shadow: inset 3px 0 0 ${cssVar.colorSuccess};
    }
  `,
);
