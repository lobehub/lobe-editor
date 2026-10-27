import { createStaticStyles } from '@lobehub/ui';

export const styles = createStaticStyles(({ css, cssVar }) => ({
  grip: css`
    pointer-events: auto;
    cursor: grab;

    position: absolute;
    z-index: 2;

    display: flex;
    align-items: center;
    justify-content: center;

    box-sizing: border-box;
    padding: 0;
    border: 1px solid ${cssVar.colorBorder};
    border-radius: 4px;

    color: ${cssVar.colorTextTertiary};

    background: ${cssVar.colorBgElevated};
    box-shadow: 0 1px 2px rgb(0 0 0 / 8%);

    transition:
      color 120ms,
      background 120ms;

    &:hover,
    &[aria-expanded='true'] {
      color: ${cssVar.colorText};
      background: ${cssVar.colorFillSecondary};
    }

    &[aria-expanded='true'] {
      border-color: ${cssVar.colorPrimary};
      color: ${cssVar.colorBgContainer};
      background: ${cssVar.colorPrimary};
    }
  `,
  gripColumn: css`
    width: 22px;
    height: 12px;
  `,
  gripCorner: css`
    width: 12px;
    height: 12px;
    border-radius: 3px;
  `,
  gripRow: css`
    width: 12px;
    height: 22px;
  `,
  insertDot: css`
    pointer-events: auto;
    cursor: pointer;

    position: absolute;
    z-index: 3;

    display: flex;
    align-items: center;
    justify-content: center;

    width: 16px;
    height: 16px;
    padding: 0;
    border: 0;
    border-radius: 50%;

    color: ${cssVar.colorBgContainer};

    background: ${cssVar.colorPrimary};
    box-shadow: 0 1px 3px rgb(0 0 0 / 20%);
  `,
  insertLine: css`
    pointer-events: none;

    position: absolute;
    z-index: 2;

    border-radius: 1px;

    opacity: 0.6;
    background: ${cssVar.colorPrimary};
  `,
  layer: css`
    pointer-events: none;
    position: absolute;
    inset-block-start: 0;
    inset-inline-start: 0;
  `,
}));
