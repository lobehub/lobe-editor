import { createStaticStyles } from '@lobehub/ui';

export const styles = createStaticStyles(({ css, cssVar }) => ({
  item: css`
    cursor: pointer;

    display: flex;
    gap: 8px;
    align-items: center;

    min-block-size: 30px;
    padding-block: 0;
    padding-inline: 10px;
    border: 0;
    border-radius: 6px;

    font: inherit;
    font-size: 13px;
    color: ${cssVar.colorText};
    text-align: start;
    white-space: nowrap;

    background: transparent;

    svg {
      flex: none;
      color: ${cssVar.colorTextTertiary};
    }

    &:hover {
      background: ${cssVar.colorFillTertiary};
    }
  `,
  itemDanger: css`
    color: ${cssVar.colorError};

    svg {
      color: ${cssVar.colorError};
    }

    &:hover {
      background: ${cssVar.colorErrorBg};
    }
  `,
  label: css`
    padding-block: 6px 2px;
    padding-inline: 10px;
    font-size: 11px;
    color: ${cssVar.colorTextQuaternary};
  `,
  menu: css`
    pointer-events: auto;

    position: fixed;
    z-index: 1000;

    display: flex;
    flex-direction: column;
    gap: 1px;

    box-sizing: border-box;
    min-inline-size: 200px;
    padding: 4px;
    border: 1px solid ${cssVar.colorBorderSecondary};
    border-radius: 10px;

    background: ${cssVar.colorBgElevated};
    box-shadow: 0 12px 32px color-mix(in srgb, #000 18%, transparent);
  `,
  segment: css`
    cursor: pointer;

    display: flex;
    flex: 1;
    align-items: center;
    justify-content: center;

    block-size: 26px;
    padding: 0;
    border: 0;
    border-radius: 5px;

    color: ${cssVar.colorTextTertiary};

    background: transparent;

    &:hover {
      color: ${cssVar.colorText};
    }

    &[aria-pressed='true'] {
      color: ${cssVar.colorText};
      background: ${cssVar.colorBgContainer};
      box-shadow: 0 1px 2px rgb(0 0 0 / 12%);
    }
  `,
  segmented: css`
    display: flex;
    gap: 2px;

    margin-block: 2px 4px;
    margin-inline: 6px;
    padding: 2px;
    border-radius: 7px;

    background: ${cssVar.colorFillTertiary};
  `,
  separator: css`
    block-size: 1px;
    margin-block: 4px;
    margin-inline: 6px;
    background: ${cssVar.colorSplit};
  `,
}));
