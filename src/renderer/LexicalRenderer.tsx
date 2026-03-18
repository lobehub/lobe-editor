import { createHeadlessEditor } from '@lexical/headless';
import { $getRoot } from 'lexical';
import { type ReactElement, type ReactNode, createElement, useMemo } from 'react';

import { renderNode } from './engine/render-tree';
import { rendererNodes } from './nodes';
import { createDefaultRenderers } from './renderers';
import { getCSSVariables, getRendererClassName } from './style';
import type { LexicalRendererProps } from './types';

export function LexicalRenderer({
  value,
  overrides,
  extraNodes,
  renderContext,
  as: Tag = 'div',
  className,
  style,
  variant,
}: LexicalRendererProps): ReactElement {
  const content = useMemo(() => {
    const nodes = extraNodes ? [...rendererNodes, ...extraNodes] : rendererNodes;
    const registry = createDefaultRenderers();
    const editor = createHeadlessEditor({
      editable: false,
      nodes,
      onError: (error: Error) => {
        console.error('[LexicalRenderer]', error);
      },
    });
    const state = editor.parseEditorState(value);
    editor.setEditorState(state);

    let result: ReactNode = null;
    const headingSlugs = new Map<string, number>();
    state.read(() => {
      result = $getRoot()
        .getChildren()
        .map((child, i) =>
          renderNode(child, registry, headingSlugs, overrides, `r-${i}`, {
            ...renderContext,
            variant,
          }),
        );
    });
    return result;
  }, [value, overrides, extraNodes, renderContext, variant]);

  const cssVars = getCSSVariables(variant);

  // Mirrors Editor's structure: outer div (flex column + CSS vars + theme rules)
  // → inner div (block, allows normal margin collapse like contentEditable)
  return createElement(
    Tag,
    {
      className: getRendererClassName(className),
      style: { ...cssVars, ...style },
    },
    createElement('div', null, content),
  );
}
