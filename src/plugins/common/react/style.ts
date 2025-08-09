/* eslint-disable sort-keys-fix/sort-keys-fix */
import { createStyles } from 'antd-style';

export const useStyles = createStyles(() => ({
  indent: {
    '--lexical-indent-base-value': '40px',
  },
  textBold: {
    fontWeight: 'bold',
  },
  textItalic: {
    fontStyle: 'italic',
  },
  textUnderline: {
    textDecoration: 'underline',
  },
  textStrikethrough: {
    textDecoration: 'line-through',
  },
  textUnderlineStrikethrough: {
    textDecoration: 'underline line-through',
  },
  quote: {
    margin: '0 0 10px 20px',
    fontSize: '15px',
    color: '#65676b',
    borderLeftColor: '#ced0d4',
    borderLeftWidth: '4px',
    borderLeftStyle: 'solid',
    paddingLeft: '16px',
  },
}));

// .editor_indent {
//   --lexical-indent-base-value: 40px;
// }
// .editor_textBold {
//   font-weight: bold;
// }
// .editor_paragraph mark {
//   background-color: unset;
// }
// .editor_textHighlight {
//   background: rgba(255, 212, 0, 0.14);
//   border-bottom: 2px solid rgba(255, 212, 0, 0.3);
// }
// .editor_textItalic {
//   font-style: italic;
// }
// .editor_textUnderline {
//   text-decoration: underline;
// }

// .editor_textStrikethrough {
//   text-decoration: line-through;
// }

// .editor_textUnderlineStrikethrough {
//   text-decoration: underline line-through;
// }

// .editor_quote {
//   margin: 0 0 10px 20px;
//   font-size: 15px;
//   color: #65676b;
//   border-left-color: #ced0d4;
//   border-left-width: 4px;
//   border-left-style: solid;
//   padding-left: 16px;
// }
