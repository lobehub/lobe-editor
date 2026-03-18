import katex from 'katex';
import { type ReactNode, createElement } from 'react';

import { getMathBlockClassName, getMathInlineClassName } from '../style';

export function renderMath(node: Record<string, any>, key: string): ReactNode {
  const code = (node.code as string) || '';
  const displayMode = node.type === 'mathBlock';

  const html = katex.renderToString(code, {
    displayMode,
    throwOnError: false,
  });

  return createElement(displayMode ? 'div' : 'span', {
    className: displayMode ? getMathBlockClassName() : getMathInlineClassName(),
    dangerouslySetInnerHTML: { __html: html },
    key,
  });
}
