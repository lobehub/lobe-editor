import { createHeadlessEditor } from '@lexical/headless';
import { MotionComponent, MotionProvider } from '@lobehub/ui';
import { $getRoot } from 'lexical';
import { motion } from 'motion/react';
import { createElement, type ReactElement, type ReactNode, use, useMemo } from 'react';

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
  // @lobehub/ui >= 5.38 requires a motion component from context (ConfigProvider
  // or MotionProvider). The renderer must stay self-contained for standalone
  // SSR/static usage, so provide a default only when the host has not already
  // supplied one — a host-provided (possibly lazy) motion component wins.
  const inheritedMotion = use(MotionComponent);
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
  const tree = createElement(
    Tag,
    {
      className: getRendererClassName(className),
      style: { ...cssVars, ...style },
    },
    createElement('div', null, content),
  );

  return inheritedMotion ? tree : createElement(MotionProvider, { children: tree, motion });
}
