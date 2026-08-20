import { createStaticStyles } from 'antd-style';

export const styles = createStaticStyles(({ css, cssVar }) => {
  const root = css`
    width: 280px;
    padding-block: 8px;
    padding-inline: 12px;

    color: ${cssVar.colorTextSecondary};

    transition:
      width 160ms ease,
      padding 160ms ease;
  `;

  const slot = css`
    width: 0;
    min-width: 0;
  `;

  const slotFloating = css`
    pointer-events: none;

    position: absolute;
    z-index: 20;
    inset-block-start: 0;
    inset-inline-end: 0;

    height: 100%;
  `;

  const slotPinned = css`
    pointer-events: auto;

    position: absolute;
    z-index: 20;
    inset-inline-end: 0;

    width: 280px;
    height: 100%;
  `;

  const rootFloating = css`
    pointer-events: auto;

    position: absolute;
    z-index: 20;
    inset-block-start: 0;
    inset-inline-end: 0;

    overflow: auto;

    max-height: 640px;

    background: ${cssVar.colorBgContainer};
  `;

  const rootPinned = css`
    position: relative;
    overflow: auto;
    max-height: calc(100vh - 32px);
    border-inline-start: 1px solid ${cssVar.colorBorderSecondary};
  `;

  const rootPinnedFixed = css`
    position: fixed;
    z-index: 20;
    inset-block-start: 16px;

    overflow: auto;

    max-height: calc(100vh - 32px);
    border-inline-start: 1px solid ${cssVar.colorBorderSecondary};
  `;

  const rootPinnedBottomed = css`
    position: absolute;
    z-index: 20;
    inset-inline-start: 0;

    overflow: auto;

    max-height: calc(100vh - 32px);
    border-inline-start: 1px solid ${cssVar.colorBorderSecondary};
  `;

  const rootCollapsed = css`
    overflow: visible;
    width: 24px;
    padding: 0;
    background: transparent;
  `;

  const header = css`
    display: flex;
    gap: 10px;
    align-items: center;

    height: 32px;
    padding-inline: 8px;

    font-weight: 600;
    color: ${cssVar.colorText};
  `;

  const headerActions = css`
    display: flex;
    gap: 8px;
    align-items: center;

    margin-inline-start: auto;

    color: ${cssVar.colorTextTertiary};
  `;

  const icon = css`
    display: block;
    width: 16px;
    height: 16px;
  `;

  const iconButton = css`
    cursor: pointer;

    display: inline-flex;
    align-items: center;
    justify-content: center;

    width: 24px;
    height: 24px;
    padding: 0;
    border: 0;
    border-radius: ${cssVar.borderRadiusSM}px;

    color: inherit;

    background: transparent;

    &:hover {
      color: ${cssVar.colorText};
      background: ${cssVar.colorFillTertiary};
    }
  `;

  const list = css`
    display: flex;
    flex-direction: column;
    gap: 2px;

    margin: 0;
    padding: 0;

    list-style: none;
  `;

  const children = css`
    margin: 0;
    padding: 0;
    list-style: none;
  `;

  const item = css`
    margin: 0;
    padding: 0;
  `;

  const button = css`
    cursor: pointer;

    display: flex;
    align-items: center;

    width: 100%;
    min-width: 0;
    height: 32px;
    padding-block: 0;
    padding-inline: 8px;
    border: 0;
    border-radius: ${cssVar.borderRadiusSM}px;

    font: inherit;
    color: inherit;
    text-align: start;

    background: transparent;

    &:hover {
      color: ${cssVar.colorText};
      background: ${cssVar.colorFillTertiary};
    }
  `;

  const buttonActive = css`
    color: ${cssVar.colorText};
    background: ${cssVar.colorFillSecondary};
  `;

  const marker = css`
    flex: none;

    width: 2px;
    height: 18px;
    margin-inline-end: 10px;
    border-radius: 2px;

    background: transparent;
  `;

  const markerActive = css`
    background: ${cssVar.colorPrimary};
  `;

  const text = css`
    overflow: hidden;
    flex: 1;

    min-width: 0;

    text-overflow: ellipsis;
    white-space: nowrap;
  `;

  const empty = css`
    padding-block: 12px;
    padding-inline: 8px;
    color: ${cssVar.colorTextTertiary};
  `;

  const rail = css`
    cursor: pointer;

    display: flex;
    flex-direction: column;
    gap: 24px;
    align-items: flex-end;

    width: 24px;
    height: 100%;
    min-height: 360px;
    padding-block: 56px;
    padding-inline: 0;
    border: 0;
    border-inline-end: 1px solid ${cssVar.colorBorderSecondary};

    background: transparent;
  `;

  const railBar = css`
    display: block;
    max-width: 30px;
    height: 2px;
    background: ${cssVar.colorTextTertiary};
  `;

  const railBarActive = css`
    background: ${cssVar.colorPrimary};
  `;

  return {
    button,
    buttonActive,
    children,
    empty,
    header,
    headerActions,
    icon,
    iconButton,
    item,
    list,
    marker,
    markerActive,
    rail,
    railBar,
    railBarActive,
    root,
    rootCollapsed,
    rootFloating,
    rootPinned,
    rootPinnedBottomed,
    rootPinnedFixed,
    slot,
    slotFloating,
    slotPinned,
    text,
  };
});
