import { createStyles } from 'antd-style';

export const useStyles = createStyles(({ cx, css, token }) => {
  const position = css`
    position: absolute;
    z-index: 999;
  `;
  return {
    link: css`
      cursor: pointer;

      margin-block: 1em;
      margin-inline: 0;
      padding: 2px;
      border: none;
    `,
    linkEdit: cx(
      position,
      css`
        min-width: 320px;
        max-width: 100%;
        background: ${token.colorBgElevated};
      `,
    ),

    linkEditFooter: css`
      border-block-start: 1px solid ${token.colorBorderSecondary};
      background: ${token.colorFillQuaternary};
    `,

    linkToolbar: cx(
      position,
      css`
        background: ${token.colorBgElevated};
      `,
    ),
  };
});
