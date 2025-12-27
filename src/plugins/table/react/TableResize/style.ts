import { createStaticStyles } from 'antd-style';

export const MIN_ROW_HEIGHT = 33;
export const MIN_COLUMN_WIDTH = 92;

export const styles = createStaticStyles(({ css, cssVar }) => {
  return css`
    touch-action: none;
    position: absolute;
    z-index: 1;

    @media (pointer: coarse) {
      background-color: ${cssVar.colorPrimary};
      mix-blend-mode: color;
    }
  `;
});
