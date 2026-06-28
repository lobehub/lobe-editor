import { createStaticStyles, cx } from 'antd-style';

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
    linkCard: css`
      user-select: none;

      display: inline-block;

      max-width: 100%;
      border-radius: 5px;

      line-height: 1;
      vertical-align: baseline;

      &.hover,
      &.selected {
        outline: 2px solid ${cssVar.colorPrimaryBorder};
        outline-offset: 1px;
      }
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

    linkIframe: css`
      margin-block: 8px;
    `,

    linkToolbar: cx(
      position,
      css`
        position: fixed;

        overflow: hidden;

        border: 1px solid ${cssVar.colorBorderSecondary};
        border-radius: 6px;

        background: ${cssVar.colorBgElevated};
        box-shadow: ${cssVar.boxShadowSecondary};
      `,
    ),

    schemaLink: css`
      margin-block: 8px;
    `,
  };
});
