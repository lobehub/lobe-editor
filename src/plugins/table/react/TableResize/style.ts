import { createStaticStyles } from '@lobehub/ui';

export const MIN_ROW_HEIGHT = 33;
export const MIN_COLUMN_WIDTH = 92;

export const styles = createStaticStyles(({ css, cssVar }) => {
  return css`
    touch-action: none;
    position: absolute;
    z-index: 1;

    &[data-direction='right']::after {
      content: '';

      position: absolute;
      inset-block: 0;
      inset-inline-start: 50%;
      translate: -50% 0;

      width: 2px;

      opacity: 0;
      background: ${cssVar.colorPrimary};

      transition: opacity 120ms;
    }

    &[data-direction='right']:hover::after {
      opacity: 0.5;
    }

    @media (pointer: coarse) {
      background-color: ${cssVar.colorPrimary};
      mix-blend-mode: color;
    }
  `;
});
