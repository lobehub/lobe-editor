import { createStyles } from 'antd-style';

export const BUTTON_WIDTH_PX = 20;
export const useStyles = createStyles(({ css }) => {
  return {
    tableAddColumns: css`
      position: absolute;
      height: 100%;
    `,

    tableAddRows: css`
      position: absolute;
      width: calc(100% - 25px);
    `,
  };
});
