import { createStaticStyles } from 'antd-style';

export const styles = createStaticStyles(
  ({ css, cssVar }) => css`
    cursor: pointer;

    display: flex;
    align-items: center;

    width: 100%;
    height: calc(var(--lobe-markdown-margin-multiple) * 1em);
    margin-block: calc(var(--lobe-markdown-margin-multiple) * 1em);

    hr {
      width: 100%;
      border-color: ${cssVar.colorBorder};
      border-style: dashed;
      border-width: 1px;
      border-block-start: none;
      border-inline-start: none;
      border-inline-end: none;
    }

    &.selected {
      background: ${cssVar.yellow};

      hr {
        border-color: #000;
      }
    }
  `,
);
