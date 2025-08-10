import { createStyles } from 'antd-style';

export const useStyles = createStyles(
  ({ css }) => css`
    pointer-events: none;

    .table-column-controller {
      pointer-events: all;

      position: absolute;
      inset-block-start: 0;
      inset-inline-start: 0;
      transform: translateY(-100%);

      height: 12px;
    }

    .table-column-controller-item {
      cursor: pointer;

      position: relative;

      display: inline-block;

      height: 12px;
      border-color: #e7e9e8;
      border-style: solid;
      border-width: 1px 0 1px 1px;

      font-size: 1px;

      background-color: #f4f5f5;

      &:last-child {
        margin-inline: 0 -1px;
        border-inline-end: 1px solid #e7e9e8;
      }
    }

    .table-row-controller {
      pointer-events: all;

      position: absolute;
      inset-block-start: 2px;
      inset-inline-start: -11px;

      width: 11px;
    }

    .table-row-controller-item {
      cursor: pointer;

      position: relative;

      width: 11px;
      border-color: #e7e9e8;
      border-style: solid;
      border-width: 1px 0 1px 1px;

      background-color: #f4f5f5;
    }

    .table-row-corner {
      pointer-events: all;
      cursor: pointer;

      position: absolute;
      inset-block-start: -8px;
      inset-inline-start: -11px;

      width: 11px;
      height: 12px;
      border-color: #e7e9e8;
      border-style: solid;
      border-width: 1px 0 1px 1px;
      border-start-start-radius: 50%;

      background-color: #f4f5f5;
    }
  `,
);
