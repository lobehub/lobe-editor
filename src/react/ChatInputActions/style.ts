import { createStyles } from 'antd-style';

export const useStyles = createStyles(({ css }) => ({
  container: css`
    position: relative;
    overflow: hidden;
    width: 100%;
  `,
  divider: css`
    margin-inline: 4px;
  `,
}));
