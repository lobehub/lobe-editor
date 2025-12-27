import { createStaticStyles } from 'antd-style';

export const styles = createStaticStyles(({ css, cssVar }) => ({
  brokenImage: css`
    width: 200px;
    height: auto;
  `,

  imageContainer: css`
    cursor: default;
    user-select: none;

    position: relative;

    overflow: hidden;
    display: inline-block;

    width: auto;
    max-width: 100%;
    height: auto;
    border-radius: ${cssVar.borderRadiusSM};

    transition: border-color 0.2s ease;

    &.selected {
      cursor: pointer;
      outline: none;

      &::after {
        pointer-events: none;
        content: '';

        position: absolute;
        z-index: 10;
        inset: 0;

        background-color: color-mix(in srgb, ${cssVar.yellow} 10%, transparent);
      }
    }
  `,

  lazyImage: css`
    cursor: default;
  `,

  resizeHandle: css`
    pointer-events: auto;
    cursor: col-resize;

    position: absolute;
    z-index: 9999;
    inset-block-start: 0;

    width: 6px;
    height: 100%;

    &::after {
      pointer-events: none;
      content: '';

      position: absolute;
      inset-block-start: 50%;
      inset-inline-start: 0;
      transform: translateY(-50%);

      width: 6px;
      height: min(80px, 80%);
      border: 1px solid color-mix(in srgb, rgb(255, 255, 255) 75%, transparent);
      border-radius: 3px;

      background-color: color-mix(in srgb, rgb(0, 0, 0) 50%, transparent);
    }
  `,

  resizeHandleLeft: css`
    inset-inline-start: 8px;
  `,

  resizeHandleRight: css`
    inset-inline-end: 8px;
  `,

  scaleInfo: css`
    pointer-events: none;

    position: absolute;
    z-index: 11;
    inset-block-start: 2px;
    inset-inline-start: 2px;

    padding-block: 2px;
    padding-inline: 6px;
    border-radius: ${cssVar.borderRadiusSM};

    font-size: 12px;
    color: white;

    background-color: color-mix(in srgb, rgb(0, 0, 0) 50%, transparent);
  `,
}));
