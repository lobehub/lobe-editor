import { createStaticStyles } from '@lobehub/ui';

export const styles = createStaticStyles(({ css, cssVar }) => ({
  column: css`
    display: flex;
    flex-direction: column;
    gap: 8px;
  `,
  hint: css`
    font-size: 12px;
    line-height: 1.5;
    color: ${cssVar.colorTextSecondary};
  `,
  label: css`
    font-size: 12px;
    color: ${cssVar.colorTextSecondary};
  `,
  preset: css`
    cursor: pointer;

    flex: 1;

    height: 24px;
    border: 1px solid ${cssVar.colorBorderSecondary};
    border-radius: ${cssVar.borderRadiusSM};

    font-size: 12px;
    font-variant-numeric: tabular-nums;
    color: ${cssVar.colorText};

    background: transparent;

    &:hover {
      background: ${cssVar.colorFillTertiary};
    }
  `,
  presetActive: css`
    border-color: ${cssVar.colorText};
  `,
  presets: css`
    display: flex;
    gap: 6px;
  `,
  pxInput: css`
    width: 96px;
    height: 28px;
    padding-block: 0;
    padding-inline: 8px;
    border: 1px solid ${cssVar.colorBorder};
    border-radius: ${cssVar.borderRadiusSM};

    font-family: inherit;
    font-size: 13px;
    font-variant-numeric: tabular-nums;
    color: ${cssVar.colorText};

    background: ${cssVar.colorBgContainer};
    outline: none;

    &:focus {
      border-color: ${cssVar.colorText};
    }
  `,
  readout: css`
    width: 40px;
    font-size: 13px;
    font-variant-numeric: tabular-nums;
    text-align: end;
  `,
  root: css`
    display: flex;
    flex-direction: column;
    gap: 8px;
  `,
  row: css`
    display: flex;
    gap: 8px;
    align-items: center;
  `,
  slider: css`
    flex: 1;
    margin: 0;
    accent-color: ${cssVar.colorText};
  `,
}));
