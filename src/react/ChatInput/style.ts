import { createStyles } from 'antd-style';

export const useStyles = createStyles(({ css, token }) => ({
  container: css`
    position: relative;

    border: 1px solid ${token.colorBorderSecondary};
    border-radius: ${token.borderRadiusLG}px;

    background-color: ${token.colorBgContainer};
    box-shadow:
      ${token.boxShadowTertiary},
      0 32px 0 ${token.colorBgContainerSecondary};
  `,
  editor: css`
    overflow: hidden auto;
    flex: 1;

    width: 100%;
    padding-block: 8px 0;
    padding-inline: 12px;
  `,
}));
