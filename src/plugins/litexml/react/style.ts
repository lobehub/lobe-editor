import { createStyles } from 'antd-style';

export const useStyles = createStyles(
  ({ css, token }) => css`
    position: relative;
    border: 1px solid ${token.colorBorderSecondary};

    .toolbar {
      position: absolute;
      z-index: 10;
      inset-block-start: 0;
      inset-inline-end: 0;

      display: flex;
      gap: 4px;
      align-items: center;

      padding: 4px;
      border: 1px solid #eee;
      border-radius: 4px;

      background: #fff;
      box-shadow: 0 2px 4px rgba(0, 0, 0, 10%);
    }

    .toolbarButton {
      cursor: pointer;

      display: flex;
      align-items: center;
      justify-content: center;

      padding: 2px;
      border: none;

      background: none;
    }

    .toolbarButton:focus {
      border-radius: 3px;
      outline: 2px solid ${token.colorPrimary};
      outline-offset: 2px;
    }

    .accept {
      color: ${token.colorSuccess};
    }

    .reject {
      color: ${token.colorError};
    }

    &[data-diff-type='add'] .content {
      position: relative;
      background-color: ${token.colorSuccessBgHover};
    }

    &[data-diff-type='remove'] .content {
      position: relative;
      background-color: ${token.colorErrorBgHover};

      > *:first-child p,
      > *:first-child span {
        text-decoration: line-through;
      }
    }

    &[data-diff-type='modify'] .content {
      position: relative;

      /* first child: original (deleted) */
      > *:first-child {
        opacity: 0.6;
      }

      /* visually indicate deletion with strike-through for text nodes */
      > *:first-child p,
      > *:first-child span {
        text-decoration: line-through;
      }

      /* second child: modified/new - normal appearance */
      > *:nth-child(2) {
        color: inherit;
        opacity: 1;
      }
    }
  `,
);
