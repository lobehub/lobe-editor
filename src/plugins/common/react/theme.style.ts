/* eslint-disable sort-keys-fix/sort-keys-fix */
import { createStyles } from 'antd-style';

export const useThemeStyles = createStyles(({ css }) => ({
  textBold: css`
    font-weight: bold;
  `,
  textItalic: css`
    font-style: italic;
  `,
  textUnderline: css`
    text-decoration: underline;
  `,
  textStrikethrough: css`
    text-decoration: line-through;
  `,
  textUnderlineStrikethrough: css`
    text-decoration: underline line-through;
  `,
  textCode: 'editor_code',
  quote: 'editor_quote',
}));
