import { createStaticStyles } from 'antd-style';

export const styles = createStaticStyles(({ css, cssVar }) => {
  const hoverable = `
    cursor: pointer;
    background-color: ${cssVar.colorFillTertiary};
    transition: background-color 0.12s ease;

    &:hover {
      background-color: ${cssVar.colorPrimaryBg};
    }
  `;

  return {
    col: css`
      ${hoverable};
      position: relative;

      block-size: 14px;
      border-color: ${cssVar.colorFillSecondary};
      border-style: solid;
      border-width: 1px 0 0 1px;
    `,
    colLast: css`
      border-width: 1px 1px 0;
    `,
    colTop: css`
      position: relative;
      inset-block-start: 0;
      inset-inline-start: 0;

      display: flex;

      block-size: 14px;
    `,
    corner: css`
      ${hoverable};
      position: absolute;
      z-index: 4;
      inset-block-start: 0;
      inset-inline-start: -14px;

      box-sizing: border-box;
      inline-size: 15px;
      block-size: 15px;
      border: 1px solid ${cssVar.colorFillSecondary};
    `,
    row: css`
      ${hoverable};
      position: relative;

      box-sizing: border-box;
      inline-size: 15px;
      border-color: ${cssVar.colorFillSecondary};
      border-style: solid;
      border-width: 1px 0.5px 0 1px;
    `,
    rowLast: css`
      border-width: 1px 0.5px 1px 1px;
    `,
    rowLeft: css`
      position: absolute;
      z-index: 3;
      inset-block-start: 14px;
      inset-inline-start: -14px;

      inline-size: 15px;
    `,
  };
});
