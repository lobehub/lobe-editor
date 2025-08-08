import { createStyles } from 'antd-style';

export const useStyles = createStyles(({ css, token }) => ({
  horizontalRule: css`
    margin-block: ${token.margin}px;
    margin-inline: 0;
    padding: 2px;
    border: none;

    &::after {
      content: '';

      display: block;

      height: 2px;

      line-height: 2px;

      background-color: ${token.colorBorder};
    }
  `,
}));
