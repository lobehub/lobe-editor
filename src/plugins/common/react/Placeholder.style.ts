/* eslint-disable sort-keys-fix/sort-keys-fix */
import { createStyles } from 'antd-style';

export const useStyles = createStyles(({ token }) => ({
  placeholder: {
    userSelect: 'none',
    pointerEvents: 'none',
    insetBlockStart: 0,
    color: token.colorTextSecondary,
    marginBlock: '4px',
    fontSize: 'var(--lobe-markdown-font-size)',
    lineHeight: 'var(--lobe-markdown-line-height)',
  },
  placeholderContainer: {
    transform: 'translateY(-2px)',
  },
}));
