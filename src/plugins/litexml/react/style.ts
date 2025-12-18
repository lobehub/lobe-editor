import { createStyles } from 'antd-style';

export const useStyles = createStyles(
  ({ css, token }) => css`
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
      border-inline-end: 3px solid ${token.colorSuccess};
    }

    &[data-diff-type='remove'] .content {
      position: relative;
      margin-block-start: calc(var(--lobe-markdown-margin-multiple) * 0.5em);
      padding-inline-end: 4px;
      border-inline-end: 3px solid ${token.colorError};

      > *:first-child * {
        color: ${token.colorTextQuaternary} !important;
        text-decoration: line-through !important;
      }
    }

    &[data-diff-type='modify'] .content {
      position: relative;
      margin-block-start: calc(var(--lobe-markdown-margin-multiple) * 0.5em);
      padding-inline-end: 4px;
      border-inline-end: 3px solid ${token.colorWarning};

      /* first child: original (deleted) */

      /*  > *:first-child {}  */

      /* visually indicate deletion with strike-through for text nodes */
      > *:first-child * {
        color: ${token.colorTextQuaternary} !important;
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
