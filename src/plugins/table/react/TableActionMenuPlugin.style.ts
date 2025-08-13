import { createStyles } from 'antd-style';

export const useStyles = createStyles(({ css }) => {
  return css`
    will-change: transform;

    position: absolute;
    z-index: 3;
    inset-block-start: 0;
    inset-inline-start: 0;

    &.table-cell-action-button-container--active {
      pointer-events: auto;
      opacity: 1;
    }

    &.table-cell-action-button-container--inactive {
      pointer-events: none;
      opacity: 0;
    }

    .table-cell-action-button {
      cursor: pointer;

      position: absolute;
      inset-block-start: 10px;
      inset-inline-end: 10px;

      display: flex;
      display: inline-block;
      align-items: center;
      justify-content: center;

      border: 0;
      border-radius: 15px;

      color: #222;
    }

    .dropdown {
      position: fixed;
      z-index: 100;

      display: block;

      min-height: 40px;
      border-radius: 8px;

      background-color: #fff;
      box-shadow:
        0 12px 28px 0 rgba(0, 0, 0, 20%),
        0 2px 4px 0 rgba(0, 0, 0, 10%),
        inset 0 0 0 1px rgba(255, 255, 255, 50%);
    }

    .dropdown .item {
      cursor: pointer;

      display: flex;
      flex-direction: row;
      flex-shrink: 0;
      place-content: center space-between;

      min-width: 100px;
      max-width: 264px;
      margin-block: 0;
      margin-inline: 8px;
      padding: 8px;
      border: 0;
      border-radius: 8px;

      font-size: 15px;
      line-height: 16px;
      color: #050505;

      background-color: #fff;
    }

    .dropdown .item.wide {
      align-items: center;
      width: 260px;
    }

    .dropdown .item.wide .icon-text-container {
      display: flex;

      .text {
        min-width: 120px;
      }
    }

    .dropdown .item .shortcut {
      align-self: flex-end;
      color: #939393;
    }

    .dropdown .item .active {
      display: flex;
      width: 20px;
      height: 20px;
      background-size: contain;
    }

    .dropdown .item:first-child {
      margin-block-start: 8px;
    }

    .dropdown .item:last-child {
      margin-block-end: 8px;
    }

    .dropdown .item:hover {
      background-color: #eee;
    }

    .dropdown .item .text {
      display: flex;
      flex-grow: 1;
      min-width: 150px;
      line-height: 20px;
    }

    .dropdown .item .icon {
      user-select: none;

      display: flex;

      width: 20px;
      height: 20px;
      margin-inline-end: 12px;

      line-height: 16px;

      background-repeat: no-repeat;
      background-position: center;
      background-size: contain;
    }

    .dropdown .divider {
      width: auto;
      height: 1px;
      margin-block: 4px;
      margin-inline: 8px;

      background-color: #eee;
    }
  `;
});

export const dropDownStyles = createStyles(({ css }) => {
  return css`
    position: fixed;
    z-index: 100;

    display: block;

    min-height: 40px;
    border-radius: 8px;

    background-color: #fff;
    box-shadow:
      0 12px 28px 0 rgba(0, 0, 0, 20%),
      0 2px 4px 0 rgba(0, 0, 0, 10%),
      inset 0 0 0 1px rgba(255, 255, 255, 50%);

    .item {
      cursor: pointer;

      display: flex;
      flex-direction: row;
      flex-shrink: 0;
      place-content: center space-between;

      min-width: 100px;
      max-width: 264px;
      margin-block: 0;
      margin-inline: 8px;
      padding: 8px;
      border: 0;
      border-radius: 8px;

      font-size: 15px;
      line-height: 16px;
      color: #050505;

      background-color: #fff;
    }

    .item.wide {
      align-items: center;
      width: 260px;
    }

    .item.wide .icon-text-container {
      display: flex;

      .text {
        min-width: 120px;
      }
    }

    .item .shortcut {
      align-self: flex-end;
      color: #939393;
    }

    .item .active {
      display: flex;
      width: 20px;
      height: 20px;
      background-size: contain;
    }

    .item:first-child {
      margin-block-start: 8px;
    }

    .item:last-child {
      margin-block-end: 8px;
    }

    .item:hover {
      background-color: #eee;
    }

    .item .text {
      display: flex;
      flex-grow: 1;
      min-width: 150px;
      line-height: 20px;
    }

    .item .icon {
      user-select: none;

      display: flex;

      width: 20px;
      height: 20px;
      margin-inline-end: 12px;

      line-height: 16px;

      background-repeat: no-repeat;
      background-position: center;
      background-size: contain;
    }

    .divider {
      width: auto;
      height: 1px;
      margin-block: 4px;
      margin-inline: 8px;

      background-color: #eee;
    }
  `;
});
