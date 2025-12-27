import { createStaticStyles } from 'antd-style';

export const styles = createStaticStyles(({ css, cssVar }) => ({
  bodyEditor: css`
    z-index: 0;
    flex: 1;
  `,
  containerDark: css`
    position: relative;

    display: flex;
    flex-direction: column;

    height: 100%;
    border: 1px solid ${cssVar.colorFillSecondary};
    border-radius: ${cssVar.borderRadiusLG};

    background-color: ${cssVar.colorBgElevated};
    box-shadow: 0 4px 4px color-mix(in srgb, #000 40%, transparent);
  `,

  containerLight: css`
    position: relative;

    display: flex;
    flex-direction: column;

    height: 100%;
    border: 1px solid ${cssVar.colorFill};
    border-radius: ${cssVar.borderRadiusLG};

    background-color: ${cssVar.colorBgElevated};
    box-shadow: 0 4px 4px color-mix(in srgb, #000 4%, transparent);
  `,

  editor: css`
    cursor: text;

    overflow: hidden auto;
    flex: 1;

    width: 100%;
    padding-block: 8px 0;
    padding-inline: 12px;
  `,
  footer: css`
    z-index: 1;
    width: 100%;
  `,

  header: css`
    z-index: 1;
    width: 100%;
  `,

  resizableContainer: css`
    position: relative;

    display: flex;
    flex: 1 1 auto;
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

      background-color: ${cssVar.colorPrimary};
      box-shadow: 0 1px 2px color-mix(in srgb, ${cssVar.colorTextSecondary} 12.5%, transparent);
    }

    &:hover {
      opacity: 1 !important;

      &::before {
        background-color: ${cssVar.colorPrimaryHover};
        box-shadow: 0 2px 4px color-mix(in srgb, ${cssVar.colorTextSecondary} 25%, transparent);
      }
    }

    &:active {
      &::before {
        background-color: ${cssVar.colorPrimaryActive};
      }
    }
  `,

  root: css`
    position: relative;
  `,
}));
