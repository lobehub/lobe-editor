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
}));
