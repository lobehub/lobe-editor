import { createStaticStyles } from '@lobehub/ui';

export const styles = createStaticStyles(({ css }) => ({
  video: css`
    cursor: default;
    user-select: none;
    position: relative;
    display: block;
  `,
}));

export const blockStyles = createStaticStyles(({ css, cssVar }) => ({
  actions: css`
    position: absolute;
    z-index: 12;
    inset-block-start: 8px;
    inset-inline-end: 8px;
  `,
  embedRow: css`
    display: flex;
    gap: 8px;
    width: min(360px, 100%);
  `,
  figure: css`
    margin-block: 0;
    margin-inline: auto;
  `,
  frame: css`
    isolation: isolate;
    position: relative;
    width: 100%;

    &.selected::after {
      pointer-events: none;
      content: '';

      position: absolute;
      z-index: 10;
      inset: 0;

      border-radius: ${cssVar.borderRadius};

      background-color: color-mix(in srgb, ${cssVar.yellow} 12%, transparent);
    }
  `,
  hint: css`
    font-size: 12px;
    color: ${cssVar.colorTextSecondary};
  `,
  placeholder: css`
    display: flex;
    flex-direction: column;
    gap: 12px;
    align-items: center;
    justify-content: center;

    box-sizing: border-box;
    width: 100%;
    min-height: 200px;
    padding: 24px;
    border: 1px dashed ${cssVar.colorBorder};
    border-radius: ${cssVar.borderRadius};

    text-align: center;

    background: ${cssVar.colorFillQuaternary};

    &.selected {
      border-color: ${cssVar.yellow};
    }
  `,
  placeholderTitle: css`
    font-size: 14px;
    font-weight: 500;
    color: ${cssVar.colorText};
  `,
  settings: css`
    display: flex;
    flex-direction: column;
    gap: 12px;
    width: 300px;
  `,
  settingsRow: css`
    display: flex;
    gap: 8px;
    align-items: center;
    justify-content: space-between;
  `,
}));
