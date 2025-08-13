import { createStyles } from 'antd-style';

export const useStyles = createStyles(({ css, token }) => {
  return css`
    .tableAddColumns {
      cursor: pointer;

      position: absolute;

      height: 100%;
      border: 0;

      background-color: ${token.colorFillSecondary};

      animation: table-controls 0.2s ease;
    }

    .tableAddColumns,
    .tableAddRows {
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .tableAddColumns:hover,
    .tableAddRows:hover {
      background-color: ${token.colorBgTextHover};
    }

    .tableAddRows {
      cursor: pointer;

      position: absolute;

      width: calc(100% - 25px);
      border: 0;

      background-color: ${token.colorFillSecondary};

      animation: table-controls 0.2s ease;
    }
  `;
});
