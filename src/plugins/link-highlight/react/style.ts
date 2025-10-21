import { createStyles } from 'antd-style';

export const useStyles = createStyles(({ css, token }) => {
  return {
    linkHighlight: css`
      cursor: pointer;

      display: inline;

      padding: 2px;

      color: ${token.colorLink};
      text-decoration: none;

      transition: all 0.2s ease;

      &:hover {
        color: ${token.colorLinkHover};
        text-decoration: underline;
      }

      ne-content {
        display: inline;
      }
    `,
  };
});
