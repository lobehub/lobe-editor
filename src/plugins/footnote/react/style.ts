import { createStaticStyles } from '@lobehub/ui';

export const styles = createStaticStyles(({ css, cssVar }) => ({
  definition: css`
    position: relative;

    padding-block: 2px;
    padding-inline-start: 2em;

    font-size: 0.875em;
    color: ${cssVar.colorTextSecondary};

    [data-footnote-label='true'] {
      user-select: none;

      position: absolute;
      inset-inline-start: 0;

      min-width: 1.5em;

      color: ${cssVar.colorTextTertiary};
    }

    [data-footnote-content='true'] {
      display: inline;
    }

    [data-footnote-back='true'] {
      cursor: pointer;
      user-select: none;

      display: inline-block;

      margin-inline-start: 4px;
      padding-block: 0;
      padding-inline: 4px;
      border: 0;
      border-radius: 4px;

      font-size: 0.875em;
      color: ${cssVar.colorTextTertiary};

      background: transparent;

      &:hover {
        color: ${cssVar.colorPrimary};
        background: ${cssVar.colorFillTertiary};
      }
    }

    &[data-footnote-orphan='true'],
    &[data-footnote-duplicate='true'] {
      opacity: 0.5;

      [data-footnote-back='true'] {
        visibility: hidden;
      }
    }

    &[data-footnote-orphan='true'] [data-footnote-label='true']::before {
      content: '–';
    }
  `,
  reference: css`
    cursor: pointer;
    user-select: none;

    padding-inline: 1px;

    line-height: 0;
    color: ${cssVar.colorPrimary};

    &:hover {
      text-decoration: underline;
    }

    &[data-footnote-missing='true'] {
      color: ${cssVar.colorError};
    }
  `,
  section: css`
    margin-block-start: calc(var(--lobe-markdown-margin-multiple, 1) * 1em);
    padding-block-start: 8px;
    border-block-start: 1px solid ${cssVar.colorBorderSecondary};

    ol {
      margin: 0;
      padding: 0;
      list-style: none;
    }
  `,
  tooltip: css`
    display: block;
    max-width: 320px;
    white-space: pre-wrap;
  `,
  tooltipMissing: css`
    color: ${cssVar.colorErrorText};
  `,
}));
