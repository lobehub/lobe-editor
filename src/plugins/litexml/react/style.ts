import { createStaticStyles } from 'antd-style';

export const styles = createStaticStyles(
  ({ css, cssVar }) => css`
    position: relative;

    .toolbar {
      position: absolute;
      z-index: 10;
      inset-block-end: 0;
      inset-inline-end: 8px;

      opacity: 0;
    }

    &:hover {
      .toolbar {
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
