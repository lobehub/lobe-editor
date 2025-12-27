/* eslint-disable sort-keys-fix/sort-keys-fix */
import { createStaticStyles } from 'antd-style';

export const styles = createStaticStyles(({ css, cssVar }) => ({
  placeholder: css`
    pointer-events: none;
    user-select: none;

    position: absolute;
    inset-block-start: 0;

    margin-block: 4px;

    line-height: var(--lobe-markdown-line-height);
    color: ${cssVar.colorTextDescription};
    letter-spacing: 0.02em;
  `,
  placeholderContainer: css`
    transform: translateY(-2px);
  `,
}));
