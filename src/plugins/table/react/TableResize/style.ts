import { createStyles } from 'antd-style';

export const MIN_ROW_HEIGHT = 33;
export const MIN_COLUMN_WIDTH = 92;

export const useStyles = createStyles(({ css, token }) => {
  return css`
    touch-action: none;
    position: absolute;
    z-index: 1;

    @media (pointer: coarse) {
      background-color: ${token.colorPrimary};
      mix-blend-mode: color;
    }
  `;
});
