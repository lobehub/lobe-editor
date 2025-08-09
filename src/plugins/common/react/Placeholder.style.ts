/* eslint-disable sort-keys-fix/sort-keys-fix */
import { createStyles } from 'antd-style';

export const useStyles = createStyles(({ token }) => ({
  placeholder: {
    userSelect: 'none',
    position: 'absolute',
    insetBlockStart: 0,
    color: token.colorTextSecondary,
  },
}));
