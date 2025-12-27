import { createStaticStyles , cx } from 'antd-style';

export const styles = createStaticStyles(({ css, cssVar }) => {
  const position = css`
    position: absolute;
    z-index: 999;
    inset-block-start: -9999px;
    inset-inline-start: -9999px;
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
        background: ${cssVar.colorBgElevated};
      `,
    ),

    linkEditFooter: css`
      border-block-start: 1px solid ${cssVar.colorBorderSecondary};
      background: ${cssVar.colorFillQuaternary};
    `,

    linkToolbar: cx(
      position,
      css`
        background: ${cssVar.colorBgElevated};
      `,
    ),
  };
});
