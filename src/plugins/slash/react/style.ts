/* eslint-disable sort-keys-fix/sort-keys-fix */
import { createStyles } from 'antd-style';

export const useStyles = createStyles(({ token }) => ({
  typeaheadPopover: {
    position: 'relative',
    background: token.colorBgElevated,
    borderRadius: token.borderRadius,
    boxShadow: token.boxShadow,

    li: {
      'alignContent': 'center',
      'border': 0,
      'borderRadius': token.borderRadius,
      'cursor': 'pointer',
      'color': token.colorText,
      'display': 'flex',
      'backgroundColor': token.colorBgElevated,
      'flexDirection': 'row',
      'flexShrink': 0,
      'fontSize': token.fontSize,
      'lineHeight': token.lineHeight,
      'margin': 0,
      'minWidth': 180,
      'outline': 'none',
      'padding': 8,

      '&.selected': {
        backgroundColor: token.colorPrimaryBgHover,
        color: token.colorPrimaryTextHover,
      },
    },

    ul: {
      borderRadius: token.borderRadius,
      listStyle: 'none',
      margin: 0,
      maxHeight: 200,
      msOverflowStyle: 'none',
      overflow: 'hidden',
      overflowY: 'auto',
      padding: 0,
      scrollbarWidth: 'none',
    },
  },
}));
