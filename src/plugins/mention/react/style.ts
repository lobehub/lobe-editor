/* eslint-disable sort-keys-fix/sort-keys-fix */
import { createStaticStyles } from 'antd-style';

export const styles = createStaticStyles(({ css, cssVar }) => ({
  mention: css`
    user-select: none;

    position: relative;

    display: inline;

    margin-inline: 0.25em;
    padding-block: 0.2em;
    padding-inline: 0.4em;
    border: 1px solid ${cssVar.colorInfoBgHover};
    border-radius: 0.25em;

    font-size: 0.875em;
    line-height: 1;
    color: ${cssVar.colorInfo};
    word-break: break-word;
    white-space: break-spaces;

    background: ${cssVar.colorInfoBg};

    .editor_mention {
      padding: 0;
    }

    &.selected {
      color: #000;
      background: ${cssVar.yellow};
    }
  `,
}));
