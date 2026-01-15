/* eslint-disable sort-keys-fix/sort-keys-fix */
import { createStaticStyles, cx } from 'antd-style';

export const styles = createStaticStyles(({ css, cssVar }) => {
  const latex = css`
    cursor: pointer;
    user-select: none;
    font-size: 1em;

    .katex-error {
      color: ${cssVar.colorError} !important;
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
      background: ${cssVar.yellow};
    }

    &:hover {
      background: ${cssVar.colorFillTertiary};
    }

    &.editing {
      background: ${cssVar.colorFillTertiary};
    }

    &:has(.katex-error) {
      background: ${cssVar.colorErrorBg};
    }
  `;
  return {
    mathInline: cx(
      latex,
      css`
        display: inline-block;
        border-radius: calc(var(--lobe-markdown-border-radius) * 0.5px);
      `,
    ),
    mathBlock: cx(
      latex,
      css`
        overflow: auto hidden;
        display: block;
        border-radius: calc(var(--lobe-markdown-border-radius) * 1px);
        white-space: nowrap;
      `,
    ),

    mathEditor: css`
      width: 320px;
      background: ${cssVar.colorBgElevated};

      textarea {
        width: 100%;

        font-family: ${cssVar.fontFamilyCode};
        font-size: 13px;

        background: transparent !important;

        transition: none !important;
      }
    `,
    mathEditorFooter: css`
      border-block-start: 1px solid ${cssVar.colorBorderSecondary};
      background: ${cssVar.colorFillQuaternary};
    `,
    mathEditorAnchor: css`
      pointer-events: none;

      position: absolute;
      inset-block-start: -9999px;
      inset-inline-start: -9999px;

      width: 0;
      height: 0;
    `,
    mathEditorTextArea: css`
      margin-block: 4px;
    `,
    mathPlaceholder: css`
      padding-inline: 0.2em;
      font-style: italic;
    `,
  };
});
