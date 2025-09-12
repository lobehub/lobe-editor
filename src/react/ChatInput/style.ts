import { createStyles } from 'antd-style';

export const useStyles = createStyles(({ css, token }) => ({
  container: css`
    position: relative;

    display: flex;
    flex-direction: column;

    height: 100%;
    border: 1px solid ${token.colorBorderSecondary};
    border-radius: ${token.borderRadiusLG}px;

    background-color: ${token.colorBgContainer};
    box-shadow:
      ${token.boxShadowTertiary},
      0 32px 0 ${token.colorBgContainerSecondary};
  `,

  editor: css`
    overflow: hidden auto;
    flex: 1;

    width: 100%;
    padding-block: 8px 0;
    padding-inline: 12px;
  `,

  resizableContainer: css`
    position: relative;

    display: flex;
    flex-direction: column;
    align-self: flex-end;

    width: 100%;

    &:hover .resize-handle {
      opacity: 1;
    }
  `,

  resizeHandle: css`
    position: absolute;
    inset-block-start: -4px;
    inset-inline-start: 50%;
    transform: translateX(-50%);

    width: 100%;
    height: 8px;

    opacity: 0;

    transition: opacity 0.2s ease-in-out;

    &::before {
      content: '';

      position: absolute;
      inset-block-start: 0;
      inset-inline-start: 50%;
      transform: translateX(-50%);

      width: 32px;
      height: 4px;
      border-radius: 4px;

      background-color: ${token.colorPrimary};
      box-shadow: 0 1px 2px ${token.colorTextSecondary}20;
    }

    &:hover {
      opacity: 1 !important;

      &::before {
        background-color: ${token.colorPrimaryHover};
        box-shadow: 0 2px 4px ${token.colorTextSecondary}40;
      }
    }

    &:active {
      &::before {
        background-color: ${token.colorPrimaryActive};
      }
    }
  `,
}));
