import { createStyles } from 'antd-style';

export const useStyles = createStyles(
  ({ css, token }) => css`
    position: relative;

    .toolbar {
      position: absolute;
      z-index: 10;
      inset-block-start: -4px;
      inset-inline-end: 0;
      transform: translateY(-100%);

      opacity: 0;
    }

    &:hover {
      .toolbar {
        opacity: 1;
      }
    }

    &[data-diff-type='add'] .content {
      position: relative;
      padding-inline-start: 8px;
      border-inline-start: 3px solid ${token.colorSuccess};
      background-color: ${token.colorSuccessBg};
    }

    &[data-diff-type='remove'] .content {
      position: relative;
      padding-inline-start: 8px;
      border-inline-start: 3px solid ${token.colorError};
      background-color: ${token.colorErrorBg};
    }

    &[data-diff-type='modify'] .content {
      position: relative;

      /* first child: original (deleted) */
      > *:first-child {
        opacity: 0.6;
      }

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
