import { createStaticStyles } from 'antd-style';

export const BUTTON_WIDTH_PX = 20;
export const styles = createStaticStyles(({ css }) => {
  return {
    tableAddColumns: css`
      position: absolute;
    `,

    tableAddRows: css`
      position: absolute;
    `,
  };
});
