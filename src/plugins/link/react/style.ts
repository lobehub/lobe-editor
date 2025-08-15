import { createStyles } from 'antd-style';

export const useStyles = createStyles(({ css }) => {
  const position = css`
    position: absolute;
    z-index: 999;
    inset-block-start: -9999px;
    inset-inline-start: -9999px;
  `;

  return {
    editor_linkEdit: position,

    editor_linkPlugin: position,

    link: css`
      cursor: pointer;

      margin-block: 1em;
      margin-inline: 0;
      padding: 2px;
      border: none;
    `,
  };
});
