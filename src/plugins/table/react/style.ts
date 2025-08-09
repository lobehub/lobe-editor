/* eslint-disable sort-keys-fix/sort-keys-fix */
import { createStyles } from 'antd-style';

export const useStyles = createStyles(({ token }) => ({
  editor_table: {
    overflow: 'scroll scroll',
    tableLayout: 'fixed',
    borderSpacing: 0,
    borderCollapse: 'collapse',
    width: 'fit-content',
    marginBlock: '25px 30px',
  },

  editor_table_cell: {
    position: 'relative',
    overflow: 'auto',
    width: '75px',
    paddingBlock: '6px',
    paddingInline: '8px',
    border: `1px solid ${token.colorBorder}`,
    textAlign: 'start',
    verticalAlign: 'top',
    outline: 'none',
  },

  editor_table_cell_header: {
    fontWeight: 'normal',
  },

  editor_table_cell_selected: {
    'caretColor': 'transparent',

    '&::after': {
      pointerEvents: 'none',
      content: '""',

      position: 'absolute',
      inset: 0,

      backgroundColor: 'highlight',
      mixBlendMode: 'multiply',
    },
  },
}));
