import { createStyles } from 'antd-style';

export const useStyles = createStyles(
  ({ css, token, isDarkMode }) => css`
    will-change: transform;

    position: absolute;
    z-index: 10;
    inset-block-start: 0;
    inset-inline-start: 0;
    transform: translate(-10000px, -10000px);

    display: flex;

    border-color: ${token.colorFillSecondary};

    vertical-align: middle;

    opacity: 0;
    background: ${token.colorBgElevated};
    box-shadow: ${isDarkMode
      ? '0px 14px 28px -6px #0003,0px 2px 4px -1px #0000001f'
      : '0 14px 28px -6px #0000001a, 0 2px 4px -1px #0000000f'};

    transition: opacity 0.12s ${token.motionEaseOut};
  `,
);
