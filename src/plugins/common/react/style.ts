import { createStaticStyles, cx, keyframes } from 'antd-style';

const cursorBlink = keyframes`
  to {
    visibility: hidden;
  }
`;

export const themeStyles = createStaticStyles(({ css, cssVar }) => ({
  quote: 'editor_quote',
  textBold_false: css`
    font-weight: unset;
  `,
  textBold_true: css`
    font-weight: bold;
  `,
  textCode: 'editor_code',
  textItalic_false: css`
    font-style: unset;
  `,
  textItalic_true: css`
    font-style: italic;
  `,
  textStrikethrough_false: css`
    text-decoration: unset;
  `,
  textStrikethrough_true: css`
    color: ${cssVar.colorTextDescription};
    text-decoration: line-through;
  `,
  textUnderlineStrikethrough_false: css`
    text-decoration: unset;
  `,
  textUnderlineStrikethrough_true: css`
    text-decoration: underline line-through;
  `,
  textUnderline_false: css`
    text-decoration: unset;
  `,
  textUnderline_true: css`
    text-decoration: underline;
  `,
}));

export const styles = createStaticStyles(({ css, cssVar }) => {
  const __root = css`
    --lobe-markdown-font-size: var(--common-font-size, 16px);
    --lobe-markdown-header-multiple: var(--common-header-multiple, 1);
    --lobe-markdown-margin-multiple: var(--common-margin-multiple, 2);
    --lobe-markdown-line-height: var(--common-line-height, 1.6);
    --lobe-markdown-border-radius: ${cssVar.borderRadiusLG};
    --lobe-markdown-border-color: ${cssVar.colorFillQuaternary};

    position: relative;

    display: flex;
    flex-direction: column;

    width: 100%;
    max-width: 100%;
    height: 100%;

    font-size: var(--lobe-markdown-font-size);
    line-height: var(--lobe-markdown-line-height);
    word-break: break-word;

    [data-placeholder] {
      position: relative;
    }

    [data-placeholder]::after {
      pointer-events: none;
      content: attr(data-placeholder);
      user-select: none;

      position: absolute;
      inset-block-start: 50%;
      transform: translateY(-50%);

      padding-inline-start: 2px;

      color: ${cssVar.colorTextDescription};
      white-space: nowrap;
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
        border-block-start: 1px solid ${cssVar.colorText};

        animation: ${cursorBlink} 1.1s steps(2, start) infinite;
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
      font-size: calc(var(--lobe-markdown-font-size) * (1 + var(--lobe-markdown-header-multiple)));
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
      margin-block: 4px;
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
      border-inline-start: solid 4px ${cssVar.colorBorder};

      color: ${cssVar.colorTextSecondary};
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

      font-family: ${cssVar.fontFamilyCode};
      font-size: 0.875em;
      line-height: 1;
      word-break: break-word;
      white-space: break-spaces;

      background: ${cssVar.colorFillSecondary};
    }
  `;

  const editorContent = css`
    flex: 1;
    min-height: 0;
    outline: none;
  `;

  return {
    blockquote,
    code,
    editorContent,
    header,
    p,
    root: __root,
    variant: cx(header, p, blockquote, code),
  };
});
