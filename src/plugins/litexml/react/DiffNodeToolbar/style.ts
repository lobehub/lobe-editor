import { createStyles } from 'antd-style';

export const useStyles = createStyles(({ css, token, isDarkMode }) => ({
  accept: css`
    color: ${token.colorSuccess};
  `,
  reject: css``,
  toolbar: css`
    border-color: ${token.colorFillSecondary};
    background: ${token.colorBgElevated};
    box-shadow: ${isDarkMode
      ? '0px 14px 28px -6px #0003,0px 2px 4px -1px #0000001f'
      : '0 14px 28px -6px #0000001a, 0 2px 4px -1px #0000000f'};
  `,
}));
