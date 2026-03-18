import { createStaticStyles } from 'antd-style';
import { type ReactNode, createElement } from 'react';

const useStyles = createStaticStyles(
  ({ css, cssVar }) => css`
    display: flex;
    align-items: center;

    width: 100%;
    height: calc(var(--lobe-markdown-margin-multiple) * 1em);
    margin-block: calc(var(--lobe-markdown-margin-multiple) * 1em);

    hr {
      width: 100%;
      border-color: ${cssVar.colorBorder};
      border-style: dashed;
      border-width: 1px;
      border-block-start: none;
      border-inline-start: none;
      border-inline-end: none;
    }
  `,
);

export function renderHR(_node: Record<string, any>, key: string): ReactNode {
  return createElement('div', { className: useStyles, key }, createElement('hr'));
}
