import { createStaticStyles } from '@lobehub/ui';

export const styles = createStaticStyles(({ css, cssVar }) => ({
  brokenImage: css`
    width: 200px;
    height: auto;
  `,

  caption: css`
    display: block;

    margin-block-start: 0.5em;

    font-size: 0.875em;
    line-height: 1.5;
    color: ${cssVar.colorTextSecondary};
    text-align: center;
    word-break: break-word;
  `,

  captionInput: css`
    display: block;

    width: 100%;
    margin-block-start: 0.5em;
    padding: 0;
    border: none;

    font-family: inherit;
    font-size: 0.875em;
    line-height: 1.5;
    color: ${cssVar.colorTextSecondary};
    text-align: center;

    background: transparent;
    outline: none;

    &::placeholder {
      color: ${cssVar.colorTextQuaternary};
    }

    &:focus-visible {
      box-shadow: inset 0 -1px 0 ${cssVar.colorBorder};
    }
  `,

  fadeIn: css`
    animation: image-fade-in 0.3s ease-out;

    @keyframes image-fade-in {
      from {
        opacity: 0;
      }

      to {
        opacity: 1;
      }
    }
  `,

  imageContainer: css`
    cursor: default;
    user-select: none;

    isolation: isolate;
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

    &.loading {
      &::after {
        pointer-events: none;
        content: '';

        position: absolute;
        z-index: 10;
        inset: 0;

        background-color: color-mix(in srgb, ${cssVar.colorBgContainer} 40%, transparent);

        animation: image-loading-pulse 1.5s ease-in-out infinite;
      }

      @keyframes image-loading-pulse {
        0%,
        100% {
          opacity: 1;
        }

        50% {
          opacity: 0.4;
        }
      }
    }
  `,

  lazyImage: css`
    cursor: default;
  `,

  placeholder: css`
    display: block;
    max-width: 100%;
    border-radius: ${cssVar.borderRadiusSM};
  `,

  placeholderFrame: css`
    overflow: hidden;
    display: inline-block;

    max-width: 100%;
    border-radius: ${cssVar.borderRadiusSM};

    vertical-align: middle;
  `,

  readonly: css`
    cursor: zoom-in;

    img {
      cursor: zoom-in;
    }
  `,

  loadingIcon: css`
    pointer-events: none;

    position: absolute;
    z-index: 11;
    inset: 0;

    display: flex;
    align-items: center;
    justify-content: center;

    color: ${cssVar.colorTextSecondary};
  `,

  actions: css`
    position: absolute;
    z-index: 10000;
    inset-block-start: 8px;
    inset-inline-end: 8px;

    display: flex;
    gap: 4px;
    align-items: center;
  `,

  overlayAction: css`
    /* Overlays sit on arbitrary photos, so they stay dark in both themes. */
    && {
      border: 1px solid color-mix(in srgb, ${cssVar.colorTextLightSolid} 24%, transparent);

      color: ${cssVar.colorTextLightSolid};

      background: ${cssVar.colorBgMask};
      backdrop-filter: saturate(120%) blur(12px);
      box-shadow: ${cssVar.boxShadowSecondary};
    }

    &&:hover {
      color: ${cssVar.colorTextLightSolid};
      background:
        linear-gradient(${cssVar.colorBgMask}, ${cssVar.colorBgMask}), ${cssVar.colorBgMask};
    }

    &&:active {
      color: ${cssVar.colorTextLightSolid};
      background:
        linear-gradient(${cssVar.colorBgMask}, ${cssVar.colorBgMask}),
        linear-gradient(${cssVar.colorBgMask}, ${cssVar.colorBgMask}), ${cssVar.colorBgMask};
    }
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
      border: 1px solid color-mix(in srgb, ${cssVar.colorTextLightSolid} 75%, transparent);
      border-radius: 3px;

      background-color: ${cssVar.colorBgMask};
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
    color: ${cssVar.colorTextLightSolid};

    background-color: ${cssVar.colorBgMask};
  `,
}));
