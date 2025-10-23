import { createStyles } from 'antd-style';

export const useStyles = createStyles(({ css }) => {
  return {
    linkHighlight: css`
      cursor: unset;

      margin-block: 1em;
      margin-inline: 0;
      padding: 2px;
      border: none;
    `,
  };
});
