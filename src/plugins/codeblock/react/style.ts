import { createStaticStyles } from 'antd-style';

export const styles = createStaticStyles(({ css, cssVar }) => ({
  code: css`
    position: relative;

    overflow: hidden;
    display: block;

    width: 100%;
    margin-block: calc(var(--lobe-markdown-margin-multiple) * 0.5em);
    padding: 16px;
    border-radius: var(--lobe-markdown-border-radius);

    font-family: ${cssVar.fontFamilyCode};
    font-size: calc(var(--lobe-markdown-font-size) * 0.85);

    background: ${cssVar.colorFillTertiary} !important;
    box-shadow: 0 0 0 1px var(--lobe-markdown-border-color) inset;

    &::after {
      content: attr(data-language);

      position: absolute;
      z-index: 3;
      inset-block-end: 8px;
      inset-inline-end: 8px;

      display: block;

      padding-block: 1px;
      padding-inline: 7px;
      border-radius: ${cssVar.borderRadius};

      font-family: ${cssVar.fontFamilyCode};
      font-size: 12px;
      color: ${cssVar.colorTextSecondary};

      opacity: 0;
      background: ${cssVar.colorFillQuaternary};
      backdrop-filter: blur(8px);
      backdrop-filter: blur(8px);

      transition: opacity 0.1s;
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
