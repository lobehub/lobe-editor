import { createStyles } from 'antd-style';

export const useStyles = createStyles(
  ({ css, token }) => css`
    cursor: pointer;

    display: flex;
    align-items: center;

    width: 100%;
    height: calc(var(--lobe-markdown-margin-multiple) * 1em);
    margin-block: calc(var(--lobe-markdown-margin-multiple) * 1em);

    hr {
      width: 100%;
      border-color: ${token.colorBorder};
      border-style: dashed;
      border-width: 1px;
      border-block-start: none;
      border-inline-start: none;
      border-inline-end: none;
    }

    &.selected {
      background: ${token.yellow};

      hr {
        border-color: #000;
      }
    }
  `,
);
