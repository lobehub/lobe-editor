/* eslint-disable sort-keys-fix/sort-keys-fix */
import { createStyles } from 'antd-style';

export const useStyles = createStyles(({ token }) => ({
  editor_mention: {
    'userSelect': 'none',
    'position': 'relative',
    'display': 'inline-block',
    'color': token.colorLink,

    '&.selected': {
      backgroundColor: token.colorBgSolidHover,
    },
  },
}));
