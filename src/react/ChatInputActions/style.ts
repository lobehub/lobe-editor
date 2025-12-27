import { createStaticStyles } from 'antd-style';

export const styles = createStaticStyles(({ css }) => ({
  collapsedContainer: css`
    overflow: hidden;
    display: flex;
    align-items: center;
  `,
  container: css`
    position: relative;
    overflow: hidden;
    width: 100%;
  `,
  divider: css`
    height: 20px;
    margin-inline: 4px;
  `,
}));
