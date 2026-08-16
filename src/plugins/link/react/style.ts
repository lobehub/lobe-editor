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

      &[data-link-card-layout='block'] {
        display: block;
        margin-block: 8px;
      }

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

        padding-block: 6px;
        padding-inline: 10px;
        border: 1px solid ${cssVar.colorBorder};
        border-radius: 6px;

        background: ${cssVar.colorBgElevated};
        box-shadow: ${cssVar.boxShadowSecondary};
      `,
    ),

    popoverActionItem: css`
      cursor: pointer;

      display: flex;
      align-items: center;
      justify-content: center;

      width: 28px;
      height: 28px;
      padding: 0;
      border: 0;
      border-radius: ${cssVar.borderRadius}px;

      color: inherit;

      background: transparent;

      &:hover {
        background: ${cssVar.colorFillQuaternary};
      }
    `,

    schemaLink: css`
      margin-block: 8px;
    `,
  };
});
