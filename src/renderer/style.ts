import { createStaticStyles, cx } from 'antd-style';

import { styles as commonStyles } from '@/plugins/common/react/style';
import { styles as imageStyles } from '@/plugins/image/react/style';
import { styles as listStyles } from '@/plugins/list/react/style';
import { styles as mathStyles } from '@/plugins/math/react/style';
import { styles as mentionStyles } from '@/plugins/mention/react/style';
import { styles as tableStyles } from '@/plugins/table/react/style';

const tableHeaderFix = createStaticStyles(
  ({ css, cssVar }) => css`
    .editor_table > tbody > tr:first-of-type {
      background: ${cssVar.colorFillQuaternary};

      .editor_table_cell_header {
        font-weight: bold;
      }
    }
  `,
);

export function getRendererClassName(className?: string) {
  return cx(commonStyles.root, commonStyles.variant, className);
}

export function getListClassName(listType: string) {
  const semantic = listType === 'number' ? 'editor_listOrdered' : 'editor_listUnordered';
  return cx(semantic, listStyles);
}

export function getTableWrapperClassName() {
  return cx('editor_table_scrollable_wrapper', tableStyles, tableHeaderFix);
}

export function getMathInlineClassName() {
  return mathStyles.mathInline;
}

export function getMathBlockClassName() {
  return mathStyles.mathBlock;
}

export function getImageClassName() {
  return imageStyles.image;
}

export function getBlockImageClassName() {
  return imageStyles.blockImage;
}

export function getMentionClassName() {
  return cx('editor_mention', mentionStyles.mention);
}

export function getCSSVariables(variant?: 'default' | 'chat') {
  const isChat = variant === 'chat';
  return {
    '--common-font-size': `${isChat ? 14 : 16}px`,
    '--common-header-multiple': String(isChat ? 0.25 : 0.6),
    '--common-line-height': String(isChat ? 1.4 : 1.6),
    '--common-margin-multiple': String(isChat ? 1 : 2),
  };
}
