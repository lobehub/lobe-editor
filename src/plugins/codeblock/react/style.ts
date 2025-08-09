/* eslint-disable sort-keys-fix/sort-keys-fix */
import { createStyles } from 'antd-style';

export const useStyles = createStyles(() => ({
  editorCode: {
    'position': 'relative',
    'overflowX': 'auto',
    'display': 'block',
    'margin': 0,
    'marginBlock': '8px',
    'paddingBlock': '8px',
    'paddingInline': '52px 8px',
    'fontSize': '13px',
    'lineHeight': '1.53',
    'tabSize': '2',

    '&:before': {
      content: 'attr(data-gutter)',
      position: 'absolute',
      insetBlockStart: 0,
      insetInlineStart: 0,
      minWidth: '25px',
      padding: '8px',
      borderInlineEnd: '1px solid #ccc',
      color: '#777',
      textAlign: 'end',
      whiteSpace: 'pre-wrap',
      backgroundColor: '#eee',
    },

    '&:after': {
      content: 'attr(data-highlight-language)',
      position: 'absolute',
      insetBlockStart: 0,
      insetInlineEnd: '3px',
      padding: '3px',
      fontSize: '10px',
      color: 'rgba(0, 0, 0, 50%)',
      textTransform: 'uppercase',
    },
  },
}));
