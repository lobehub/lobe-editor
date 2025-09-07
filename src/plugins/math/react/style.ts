/* eslint-disable sort-keys-fix/sort-keys-fix */
import { createStyles } from 'antd-style';

export const useStyles = createStyles(({ cx, css, token }) => {
  const latex = css`
    user-select: none;
    font-size: 1em;

    .katex-error {
      color: ${token.colorError} !important;
    }

    .katex-html {
      overflow: auto hidden;
      padding: 3px;

      .base {
        margin-block: 0;
        margin-inline: auto;
      }

      .tag {
        position: relative !important;
        display: inline-block;
        padding-inline-start: 0.5rem;
      }
    }

    &.selected {
      color: #000;
      background: ${token.yellow};
    }

    &.editing {
      background: ${token.colorFillTertiary};
    }

    &:has(.katex-error) {
      background: ${token.colorErrorBg};
    }
  `;
  return {
    mathInline: cx(latex, css``),
    mathBlock: cx(
      latex,
      css`
        overflow: auto hidden;
        white-space: nowrap;
      `,
    ),

    mathEditor: css`
      position: absolute;
      z-index: 999;
      inset-block-start: -9999px;
      inset-inline-start: -9999px;

      min-width: 320px;
      max-width: 100%;

      background: ${token.colorBgElevated};

      textarea {
        width: 100%;

        font-family: ${token.fontFamilyCode};
        font-size: 13px;

        background: transparent !important;

        transition: none !important;
      }
    `,
    mathEditorFooter: css`
      border-block-start: 1px solid ${token.colorBorderSecondary};
      background: ${token.colorFillQuaternary};
    `,
  };
});
