import { createStaticStyles, cx } from 'antd-style';

export type DiffAppearance = 'borderless' | 'default';

const base = createStaticStyles(({ css, cssVar }) => ({
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
  deleteCell: css`
    background: color-mix(in srgb, ${cssVar.colorError} 10%, transparent);
  `,
  emptyCell: css`
    background: ${cssVar.colorFillQuaternary};
  `,
  insertCell: css`
    background: color-mix(in srgb, ${cssVar.colorSuccess} 10%, transparent);
  `,
  row: css`
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  `,
}));

const defaultOverrides = createStaticStyles(({ css, cssVar }) => ({
  cellOld: css``,
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
  root: css`
    overflow: hidden;

    border: 1px solid ${cssVar.colorBorderSecondary};
    border-radius: ${cssVar.borderRadiusSM};

    font-size: 14px;

    background: ${cssVar.colorBgContainer};
  `,
}));

const borderlessOverrides = createStaticStyles(({ css, cssVar }) => ({
  body: css`
    & > *:nth-child(odd) {
      background: ${cssVar.colorFillQuaternary};
    }
  `,
  cellOld: css``,
  header: css`
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
    column-gap: 12px;
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
  headerOld: css``,
  root: css`
    overflow: hidden;
    font-size: 14px;
    background: ${cssVar.colorBgContainer};
  `,
  row: css`
    column-gap: 12px;
  `,
}));

interface DiffStyleSet {
  body: string;
  cell: string;
  cellOld: string;
  deleteCell: string;
  emptyCell: string;
  header: string;
  headerCell: string;
  headerOld: string;
  insertCell: string;
  root: string;
  row: string;
}

function merge(baseSet: Record<string, string>, overrides: Record<string, string>): DiffStyleSet {
  const result: Record<string, string> = {};
  const allKeys = new Set([...Object.keys(baseSet), ...Object.keys(overrides)]);
  for (const key of allKeys) {
    result[key] = cx(baseSet[key], overrides[key]);
  }
  return result as unknown as DiffStyleSet;
}

export const diffStyles: Record<DiffAppearance, DiffStyleSet> = {
  borderless: merge(base, borderlessOverrides),
  default: merge(base, defaultOverrides),
};
