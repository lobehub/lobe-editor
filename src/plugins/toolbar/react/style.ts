import { createStaticStyles } from 'antd-style';

export const styles = createStaticStyles(({ css, cssVar }) => ({
  anchor: css`
    position: relative;
  `,
  toolbarDark: css`
    will-change: transform;

    position: absolute;
    z-index: 10;
    inset-block-start: 0;
    inset-inline-start: 0;
    transform: translate(-10000px, -10000px);

    display: flex;

    border-color: ${cssVar.colorFillSecondary};

    vertical-align: middle;

    opacity: 0;
    background: ${cssVar.colorBgElevated};
    box-shadow:
      0 14px 28px -6px color-mix(in srgb, #000 18.75%, transparent),
      0 2px 4px -1px color-mix(in srgb, #000 12.19%, transparent);

    transition: opacity 0.12s ${cssVar.motionEaseOut};
  `,
  toolbarLight: css`
    will-change: transform;

    position: absolute;
    z-index: 10;
    inset-block-start: 0;
    inset-inline-start: 0;
    transform: translate(-10000px, -10000px);

    display: flex;

    border-color: ${cssVar.colorFillSecondary};

    vertical-align: middle;

    opacity: 0;
    background: ${cssVar.colorBgElevated};
    box-shadow:
      0 14px 28px -6px color-mix(in srgb, #000 10.2%, transparent),
      0 2px 4px -1px color-mix(in srgb, #000 5.88%, transparent);

    transition: opacity 0.12s ${cssVar.motionEaseOut};
  `,
}));
