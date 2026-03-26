import { createStaticStyles } from 'antd-style';

export const styles = createStaticStyles(({ css, cssVar }) => ({
  body: css`
    display: flex;
    flex-direction: column;
    background: ${cssVar.colorBgContainer};
  `,
  cell: css`
    overflow: auto;
    min-width: 0;
    min-height: 24px;

    > div {
      width: 100%;
      min-width: 0;
    }
  `,
  cellOld: css``,
  deleteCell: css`
    background: color-mix(in srgb, ${cssVar.colorError} 10%, transparent);
  `,
  emptyCell: css`
    background: ${cssVar.colorFillQuaternary};
  `,
  header: css`
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
    border-block-end: 1px solid ${cssVar.colorBorderSecondary};
    background: ${cssVar.colorFillQuaternary};
  `,
  headerCell: css`
    padding-block: 8px;
    padding-inline: 16px;

    font-size: 12px;
    font-weight: 600;
    color: ${cssVar.colorTextSecondary};
    text-transform: uppercase;
    letter-spacing: 0.05em;
  `,
  headerOld: css`
    border-inline-end: 1px solid ${cssVar.colorBorderSecondary};
  `,
  insertCell: css`
    background: color-mix(in srgb, ${cssVar.colorSuccess} 10%, transparent);
  `,
  root: css`
    overflow: hidden;

    border: 1px solid ${cssVar.colorBorderSecondary};
    border-radius: ${cssVar.borderRadiusSM};

    font-size: 14px;

    background: ${cssVar.colorBgContainer};
  `,
  row: css`
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  `,
}));
