import { createStaticStyles } from '@lobehub/ui';

export const styles = createStaticStyles(({ css, cssVar }) => ({
  addButton: css`
    cursor: pointer;

    align-self: flex-start;

    padding-block: 4px;
    padding-inline: 8px;
    border: 1px dashed ${cssVar.colorBorder};
    border-radius: ${cssVar.borderRadiusSM};

    font-size: 12px;
    color: ${cssVar.colorTextSecondary};

    background: transparent;

    &:hover {
      border-color: ${cssVar.colorTextQuaternary};
      color: ${cssVar.colorText};
    }
  `,
  field: css`
    display: flex;
    flex-direction: column;
    gap: 6px;
  `,
  fieldLabel: css`
    font-size: 12px;
    color: ${cssVar.colorTextTertiary};
  `,
  grid: css`
    border-collapse: collapse;
    width: 100%;
    font-size: 12px;

    th,
    td {
      padding: 2px;
      border-block-end: 1px solid ${cssVar.colorBorderSecondary};
      text-align: start;
    }

    th {
      font-weight: 500;
    }
  `,
  gridScroll: css`
    overflow: auto;
    max-height: 280px;
  `,
  headerLabel: css`
    padding-inline: 6px;
    font-size: 11px;
    font-weight: 400;
    color: ${cssVar.colorTextQuaternary};
  `,
  hint: css`
    font-size: 12px;
    color: ${cssVar.colorTextTertiary};
  `,
  iconButton: css`
    cursor: pointer;

    display: inline-flex;
    flex: none;
    align-items: center;
    justify-content: center;

    width: 24px;
    height: 24px;
    padding: 0;
    border: 0;
    border-radius: ${cssVar.borderRadiusSM};

    color: ${cssVar.colorTextQuaternary};

    background: transparent;

    &:hover {
      color: ${cssVar.colorError};
      background: ${cssVar.colorFillTertiary};
    }
  `,
  input: css`
    box-sizing: border-box;
    width: 100%;
    min-width: 0;
    height: 28px;
    padding-inline: 8px;
    border: 1px solid ${cssVar.colorBorderSecondary};
    border-radius: ${cssVar.borderRadiusSM};

    font-size: 13px;
    color: ${cssVar.colorText};

    background: ${cssVar.colorFillQuaternary};
    outline: none;

    transition: border-color 120ms;

    &:focus {
      border-color: ${cssVar.colorPrimary};
      background: ${cssVar.colorBgContainer};
    }
  `,
  inputInvalid: css`
    border-color: ${cssVar.colorError};
  `,
  panel: css`
    display: flex;
    flex-direction: column;
    gap: 14px;

    width: 380px;
    max-height: 520px;
    padding: 12px;

    color: ${cssVar.colorText};
  `,
  row: css`
    display: flex;
    gap: 6px;
    align-items: center;
  `,
  segment: css`
    cursor: pointer;

    display: flex;
    flex: 1;
    align-items: center;
    justify-content: center;

    height: 26px;
    padding-inline: 8px;
    border: 0;
    border-radius: ${cssVar.borderRadiusSM};

    font-size: 12px;
    color: ${cssVar.colorTextSecondary};

    background: transparent;

    &[aria-pressed='true'] {
      color: ${cssVar.colorText};
      background: ${cssVar.colorBgElevated};
      box-shadow: 0 1px 2px rgb(0 0 0 / 12%);
    }
  `,
  segmented: css`
    display: flex;
    gap: 2px;

    padding: 2px;
    border-radius: ${cssVar.borderRadius};

    background: ${cssVar.colorFillTertiary};
  `,
  select: css`
    box-sizing: border-box;
    width: 100%;
    height: 28px;
    padding-inline: 6px;
    border: 1px solid ${cssVar.colorBorderSecondary};
    border-radius: ${cssVar.borderRadiusSM};

    font-size: 13px;
    color: ${cssVar.colorText};

    background: ${cssVar.colorFillQuaternary};
    outline: none;

    &:focus {
      border-color: ${cssVar.colorPrimary};
    }
  `,
  switchRow: css`
    display: flex;
    gap: 8px;
    align-items: center;
    justify-content: space-between;

    font-size: 13px;
  `,
  tabBody: css`
    overflow: auto;
    display: flex;
    flex-direction: column;
    gap: 14px;
  `,
}));
