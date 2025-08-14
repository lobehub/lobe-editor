import { createStyles } from 'antd-style';

export const useStyles = createStyles(({ css, token, stylish }) => ({
  container: css`
    position: relative;

    overflow: hidden;
    display: block;

    width: 100%;
    margin-block: calc(var(--lobe-markdown-margin-multiple) * 0.5em);
    padding: 16px;
    border-radius: calc(var(--lobe-markdown-border-radius) * 1px);

    font-family: ${token.fontFamilyCode};
    font-size: calc(var(--lobe-markdown-font-size) * 0.85);

    background: ${token.colorFillTertiary} !important;
    box-shadow: 0 0 0 1px var(--lobe-markdown-border-color) inset;

    &::after {
      border-radius: ${token.borderRadius}px;

      content: attr(data-highlight-language);

      padding-block: 1px;
      padding-inline: 7px;

      font-size: 12px;

      display: block;

      position: absolute;
      z-index: 3;
      inset-block-end: 8px;
      inset-inline-end: 8px;

      font-family: ${token.fontFamilyCode};
      color: ${token.colorTextSecondary};

      background: ${token.colorFillQuaternary};

      transition: opacity 0.1s;

      opacity: 0;

      ${stylish.blur}
    }

    &:hover {
      &::after {
        opacity: 1;
      }
    }
  `,
  noBackground: css`
    background: transparent !important;
  `,
}));
