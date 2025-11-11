import { createStyles } from 'antd-style';

export const useStyles = createStyles(
  ({ css, token }) => css`
    will-change: transform;

    position: absolute;
    z-index: 10;
    inset-block-start: 0;
    inset-inline-start: 0;
    transform: translate(-10000px, -10000px);

    display: flex;

    height: 35px;
    padding: 4px;
    border-radius: 8px;

    vertical-align: middle;

    opacity: 0;
    background: ${token.colorBgContainer};
    box-shadow: 0 5px 10px rgba(0, 0, 0, 30%);

    transition: opacity 0.5s;
  `,
);
