/* eslint-disable sort-keys-fix/sort-keys-fix */
import { createStyles } from 'antd-style';

export const useStyles = createStyles(({ css, token }) => ({
  mathInline: css`
    user-select: none;

    position: relative;

    display: inline;

    margin-inline: 0.25em;
    padding-block: 0.2em;
    padding-inline: 0.4em;
    border: 1px solid ${token.colorInfoFillTertiary};
    border-radius: 0.25em;

    font-size: 0.875em;
    line-height: 1;
    color: ${token.colorInfo};
    word-break: break-word;
    white-space: break-spaces;

    background: ${token.colorInfoFillTertiary};

    &.selected {
      color: #000;
      background: ${token.yellow};
    }
  `,
  mathBlock: css``,

  mathEditor: css`
    position: absolute;
    z-index: 999;
    inset-block-start: -9999px;
    inset-inline-start: -9999px;

    padding: 5px;
    border: ${token.colorInfoBorder};
    border-radius: ${token.borderRadiusLG}px;

    background: ${token.colorBgContainer};
    box-shadow: ${token.boxShadow};

    textarea {
      overflow-y: auto;
      min-width: 400px;
      min-height: 100px;
      max-height: 300px;
    }

    .bottom {
      display: flex;
      justify-content: flex-end;
      margin-block-start: 8px;

      .hotkey {
        margin-inline-start: 8px;
      }
    }

    .button,
    .button:hover {
      padding: 0;
      background: transparent !important;
    }
  `,
}));
