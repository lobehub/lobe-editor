import { createStyles } from 'antd-style';

export const useStyles = createStyles(({ css }) => {
  return css`
    will-change: transform;

    position: absolute;
    z-index: 3;
    inset-block-start: 0;
    inset-inline-start: 0;
    transform: translateY(100%);

    padding: 2px;
  `;
});
