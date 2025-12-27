import { createStaticStyles } from 'antd-style';

export const styles = createStaticStyles(({ css, cssVar }) => ({
  accept: css`
    color: ${cssVar.colorSuccess};
  `,
  reject: css``,
  toolbarDark: css`
    border-color: ${cssVar.colorFillSecondary};
    background: ${cssVar.colorBgElevated};
    box-shadow:
      0 14px 28px -6px color-mix(in srgb, #000 18.75%, transparent),
      0 2px 4px -1px color-mix(in srgb, #000 12.19%, transparent);
  `,
  toolbarLight: css`
    border-color: ${cssVar.colorFillSecondary};
    background: ${cssVar.colorBgElevated};
    box-shadow:
      0 14px 28px -6px color-mix(in srgb, #000 10.2%, transparent),
      0 2px 4px -1px color-mix(in srgb, #000 5.88%, transparent);
  `,
}));
