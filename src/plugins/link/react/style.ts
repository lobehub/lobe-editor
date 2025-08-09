/* eslint-disable sort-keys-fix/sort-keys-fix */
import { createStyles } from 'antd-style';

const position = {
  position: 'absolute',
  zIndex: 1000,
  insetBlockStart: '-9999px',
  insetInlineStart: '-9999px',
} as any;

export const useStyles = createStyles(({ token }) => ({
  link: {
    cursor: 'pointer',
    marginBlock: '1em',
    marginInline: 0,
    padding: '2px',
    border: 'none',
  },
  editor_linkPlugin: {
    ...position,
  },
  editor_linkEdit: {
    ...position,
    padding: '4px',
    border: `1px solid ${token.colorBorder}`,
    borderRadius: '4px',
    backgroundColor: token.colorBgElevated,
    boxShadow: '0 2px 8px rgba(0, 0, 0, 15%)',
  },
  editor_linkToolbar: {
    display: 'flex',
    gap: '2px',
    padding: '4px',
    border: `1px solid ${token.colorBorder}`,
    borderRadius: '6px',
    background: token.colorBgElevated,
    boxShadow: token.boxShadow,
  },
  editor_linkToolbar_item: {
    'cursor': 'pointer',

    'display': 'flex',
    'alignItems': 'center',
    'justifyContent': 'center',

    'width': '28px',
    'height': '28px',
    'borderRadius': '4px',

    'transition': 'background-color 0.2s',

    '&:hover': {
      backgroundColor: token.colorBgTextHover,
    },

    '&:active': {
      backgroundColor: token.colorBgTextActive,
    },
  },
}));
