import { createStyles } from 'antd-style';

import type { CommonPluginOptions } from '@/plugins/common';

export const useThemeStyles = createStyles(
  ({ css, token }, markdownOption: CommonPluginOptions['markdownOption'] = true) => {
    return {
      quote: 'editor_quote',
      textBold:
        markdownOption === true ||
        (typeof markdownOption === 'object' && markdownOption.bold === true)
          ? css`
              font-weight: bold;
            `
          : css`
              font-weight: unset;
            `,
      textCode: 'editor_code',
      textItalic:
        markdownOption === true ||
        (typeof markdownOption === 'object' && markdownOption.italic === true)
          ? css`
              font-style: italic;
            `
          : css`
              font-style: unset;
            `,
      textStrikethrough:
        markdownOption === true ||
        (typeof markdownOption === 'object' && markdownOption.strikethrough === true)
          ? css`
              color: ${token.colorTextDescription};
              text-decoration: line-through;
            `
          : css`
              text-decoration: unset;
            `,
      textUnderline:
        markdownOption === true ||
        (typeof markdownOption === 'object' && markdownOption.strikethrough === true)
          ? css`
              text-decoration: underline;
            `
          : css`
              text-decoration: unset;
            `,
      textUnderlineStrikethrough:
        markdownOption === true ||
        (typeof markdownOption === 'object' && markdownOption.underlineStrikethrough === true)
          ? css`
              text-decoration: underline line-through;
            `
          : css`
              text-decoration: unset;
            `,
    };
  },
);

export const useStyles = createStyles(
  (
    { cx, token, css },
    {
      fontSize = 16,
      headerMultiple = 1,
      marginMultiple = 2,
      lineHeight = 1.8,
    }: { fontSize?: number; headerMultiple?: number; lineHeight?: number; marginMultiple?: number },
  ) => {
    const __root = css`
      --lobe-markdown-font-size: ${fontSize}px;
      --lobe-markdown-header-multiple: ${headerMultiple};
      --lobe-markdown-margin-multiple: ${marginMultiple};
      --lobe-markdown-line-height: ${lineHeight};
      --lobe-markdown-border-radius: ${token.borderRadiusLG};
      --lobe-markdown-border-color: ${token.colorFillQuaternary};

      position: relative;

      display: flex;
      flex-direction: column;

      width: 100%;
      max-width: 100%;
      height: 100%;

      font-size: var(--lobe-markdown-font-size);
      line-height: var(--lobe-markdown-line-height);
      word-break: break-word;

      @keyframes cursor-blink {
        to {
          visibility: hidden;
        }
      }

      [data-lexical-cursor='true'] {
        pointer-events: none;
        position: absolute;
        display: block;

        &::after {
          content: '';

          position: absolute;
          inset-block-start: -2px;

          display: block;

          width: 20px;
          border-block-start: 1px solid ${token.colorText};

          animation: cursor-blink 1.1s steps(2, start) infinite;
        }
      }
    `;

    const header = css`
      h1,
      h2,
      h3,
      h4,
      h5,
      h6 {
        margin-block: max(
          calc(var(--lobe-markdown-header-multiple) * var(--lobe-markdown-margin-multiple) * 0.4em),
          var(--lobe-markdown-font-size)
        );
        font-weight: bold;
        line-height: 1.25;
      }

      h1 {
        font-size: calc(
          var(--lobe-markdown-font-size) * (1 + 1.5 * var(--lobe-markdown-header-multiple))
        );
      }

      h2 {
        font-size: calc(
          var(--lobe-markdown-font-size) * (1 + var(--lobe-markdown-header-multiple))
        );
      }

      h3 {
        font-size: calc(
          var(--lobe-markdown-font-size) * (1 + 0.5 * var(--lobe-markdown-header-multiple))
        );
      }

      h4 {
        font-size: calc(
          var(--lobe-markdown-font-size) * (1 + 0.25 * var(--lobe-markdown-header-multiple))
        );
      }

      h5,
      h6 {
        font-size: calc(var(--lobe-markdown-font-size) * 1);
      }
    `;

    const p = css`
      p {
        margin-block: calc(var(--lobe-markdown-margin-multiple) * 0.5em);
        line-height: var(--lobe-markdown-line-height);
        letter-spacing: 0.02em;

        &:not(:first-child) {
          margin-block-start: calc(var(--lobe-markdown-margin-multiple) * 0.5em);
        }

        &:not(:last-child) {
          margin-block-end: calc(var(--lobe-markdown-margin-multiple) * 0.5em);
        }
      }
    `;

    const blockquote = css`
      .editor_quote {
        margin-block: calc(var(--lobe-markdown-margin-multiple) * 0.5em);
        margin-inline: 0;
        padding-block: 0;
        padding-inline: 1em;
        border-inline-start: solid 4px ${token.colorBorder};

        color: ${token.colorTextSecondary};
      }
    `;

    const code = css`
      .editor_code {
        display: inline;

        margin-inline: 0.25em;
        padding-block: 0.2em;
        padding-inline: 0.4em;
        border: 1px solid var(--lobe-markdown-border-color);
        border-radius: 0.25em;

        font-family: ${token.fontFamilyCode};
        font-size: 0.875em;
        line-height: 1;
        word-break: break-word;
        white-space: break-spaces;

        background: ${token.colorFillSecondary};
      }
    `;

    return {
      blockquote,
      code,
      header,
      noHeader: css`
        h1,
        h2,
        h3,
        h4,
        h5,
        h6 {
          margin-block: 4px;
          font-size: var(--lobe-markdown-font-size);
          line-height: var(--lobe-markdown-line-height);
          letter-spacing: 0.02em;

          &:not(:first-child) {
            margin-block-start: calc(var(--lobe-markdown-margin-multiple) * 0.5em);
          }

          &:not(:last-child) {
            margin-block-end: calc(var(--lobe-markdown-margin-multiple) * 0.5em);
          }
        }
      `,
      noStyle: css`
        --lobe-markdown-header-multiple: 0;
        --lobe-markdown-margin-multiple: 0;
        --lobe-markdown-line-height: 1.5;

        p {
          margin-block: 0;
        }
      `,
      p,
      root: __root,
      variant: cx(header, p, blockquote, code),
    };
  },
);
