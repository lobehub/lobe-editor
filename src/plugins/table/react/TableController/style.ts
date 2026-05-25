import { createStaticStyles } from 'antd-style';

export const styles = createStaticStyles(({ css, cssVar }) => {
  const selectedBackground = `color-mix(in srgb, ${cssVar.colorPrimaryBg} 72%, ${cssVar.colorPrimary} 28%)`;
  const hoverable = `
    cursor: pointer;
    background-color: ${cssVar.colorFillTertiary};
    transition: background-color 0.12s ease;

    &:hover {
      background-color: ${cssVar.colorPrimaryBg};
    }
  `;

  return {
    col: css`
      ${hoverable};
      position: relative;

      flex-shrink: 0;

      block-size: 14px;
      border-color: ${cssVar.colorFillSecondary};
      border-style: solid;
      border-width: 1px 0 0 1px;
    `,
    colDragIndicator: css`
      inset-block-start: 14px;
      transform: translateX(-50%);
      inline-size: 2px;
    `,
    colLast: css`
      border-width: 1px 1px 0;
      border-start-end-radius: 8px;
    `,
    colSelectionDots: css`
      grid-template-columns: repeat(3, 2px);
    `,
    colTop: css`
      position: relative;
      inset-block-start: 0;
      inset-inline-start: 0;

      display: flex;

      block-size: 14px;
    `,
    corner: css`
      ${hoverable};
      position: absolute;
      z-index: 4;
      inset-block-start: 0;
      inset-inline-start: -14px;

      box-sizing: border-box;
      inline-size: 15px;
      block-size: 15px;
      border: 1px solid ${cssVar.colorFillSecondary};
      border-start-start-radius: 8px;
    `,
    deleteButton: css`
      pointer-events: none;
      cursor: pointer;

      position: fixed;
      z-index: 5;
      transform: translate(-50%, -50%);

      display: flex;
      align-items: center;
      justify-content: center;

      box-sizing: border-box;
      inline-size: 28px;
      block-size: 28px;
      padding: 0;
      border: 1px solid ${cssVar.colorBorder};
      border-radius: 4px;

      color: ${cssVar.colorText};

      opacity: 0;
      background: ${cssVar.colorBgElevated};
      box-shadow: 0 2px 8px color-mix(in srgb, #000 12%, transparent);

      &:hover {
        border-color: ${cssVar.colorErrorBorder};
        color: ${cssVar.colorError};
        background: ${cssVar.colorErrorBg};
      }
    `,
    deleteButtonVisible: css`
      pointer-events: auto;
      opacity: 1;
    `,
    dragIndicator: css`
      pointer-events: none;

      position: absolute;
      z-index: 6;

      border-radius: 999px;

      opacity: 0;
      background: ${cssVar.colorPrimary};
      box-shadow: 0 0 0 2px ${cssVar.colorPrimaryBg};
    `,
    dragIndicatorVisible: css`
      opacity: 1;
    `,
    insertButton: css`
      pointer-events: none;
      cursor: pointer;

      position: fixed;
      z-index: 5;
      transform: translate(-50%, -50%);

      display: flex;
      align-items: center;
      justify-content: center;

      box-sizing: border-box;
      inline-size: 28px;
      block-size: 28px;
      padding: 0;
      border: 1px solid ${cssVar.colorBorder};
      border-radius: 4px;

      color: ${cssVar.colorText};

      opacity: 0;
      background: ${cssVar.colorBgElevated};
      box-shadow: 0 2px 8px color-mix(in srgb, #000 12%, transparent);

      &:hover {
        border-color: ${cssVar.colorPrimary};
        color: ${cssVar.colorPrimary};
        background: ${cssVar.colorPrimaryBg};
      }
    `,
    insertButtonVisible: css`
      pointer-events: auto;
      opacity: 1;
    `,
    menu: css`
      pointer-events: auto;

      position: fixed;
      z-index: 7;

      display: flex;
      flex-direction: column;
      gap: 2px;

      box-sizing: border-box;
      padding: 6px;
      border: 1px solid ${cssVar.colorBorderSecondary};
      border-radius: 8px;

      background: ${cssVar.colorBgElevated};
      box-shadow: 0 8px 24px color-mix(in srgb, #000 18%, transparent);
    `,
    menuItem: css`
      cursor: pointer;

      display: flex;
      align-items: center;

      min-block-size: 32px;
      padding-block: 0;
      padding-inline: 10px;
      border: 0;
      border-radius: 5px;

      font: inherit;
      color: ${cssVar.colorText};
      text-align: start;
      white-space: nowrap;

      background: transparent;

      &:hover {
        background: ${cssVar.colorFillTertiary};
      }
    `,
    menuItemDanger: css`
      color: ${cssVar.colorError};

      &:hover {
        background: ${cssVar.colorErrorBg};
      }
    `,
    menuSeparator: css`
      block-size: 1px;
      margin-block: 4px;
      margin-inline: -6px;
      background: ${cssVar.colorSplit};
    `,
    row: css`
      ${hoverable};
      position: relative;

      box-sizing: border-box;
      inline-size: 15px;
      border-color: ${cssVar.colorFillSecondary};
      border-style: solid;
      border-width: 1px 0.5px 0 1px;
    `,
    rowDragIndicator: css`
      inset-inline-start: 15px;
      transform: translateY(-50%);
      block-size: 2px;
    `,
    rowLast: css`
      border-width: 1px 0.5px 1px 1px;
      border-end-start-radius: 8px;
    `,
    rowLeft: css`
      position: absolute;
      z-index: 3;
      inset-block-start: 14px;
      inset-inline-start: -14px;

      inline-size: 15px;
    `,
    rowSelectionDots: css`
      grid-template-columns: repeat(2, 2px);
    `,
    selected: css`
      cursor: move;
      background-color: ${selectedBackground};

      &:hover {
        background-color: ${selectedBackground};
      }
    `,
    selectedCorner: css`
      cursor: pointer;
    `,
    selectionDots: css`
      pointer-events: none;

      position: absolute;
      inset-block-start: 50%;
      inset-inline-start: 50%;
      transform: translate(-50%, -50%);

      display: grid;
      gap: 2px;

      opacity: 0;

      > span {
        inline-size: 2px;
        block-size: 2px;
        border-radius: 50%;
        background: ${cssVar.colorTextLightSolid};
      }
    `,
    selectionDotsVisible: css`
      opacity: 1;
    `,
  };
});
