import { createStaticStyles } from '@lobehub/ui';

export const styles = createStaticStyles(({ css, cssVar }) => ({
  file: css`
    user-select: none;

    display: inline-block;

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

    span {
      user-select: none;
    }

    &.selected {
      color: #000;
      background: ${cssVar.yellow};
    }
  `,
  fileAction: css`
    cursor: pointer;

    display: inline-flex;
    align-items: center;
    justify-content: center;

    padding: 0.15em;
    border-radius: 0.25em;

    color: ${cssVar.colorTextTertiary};
    text-decoration: none;

    &:hover {
      color: ${cssVar.colorText};
      background: ${cssVar.colorFillTertiary};
    }
  `,
  fileContent: css`
    display: inline-flex;
    gap: 0.2em;
    align-items: center;
    vertical-align: middle;
  `,
  fileActions: css`
    display: inline-flex;
    gap: 0.1em;
    align-items: center;
    margin-inline-start: 0.2em;
  `,
  fileName: css`
    word-break: break-word;
  `,
}));
