/* eslint-disable sort-keys-fix/sort-keys-fix */
import { createStyles } from 'antd-style';

export const useStyles = createStyles(({ token }) => ({
  editor_file: {
    'userSelect': 'none',
    'position': 'relative',
    'display': 'inline-block',

    '&.selected': {
      backgroundColor: token.colorPrimaryBg,
    },
  },
}));
