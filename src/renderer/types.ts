import type { Klass, LexicalNode, SerializedEditorState } from 'lexical';
import type { CSSProperties, JSX, ReactNode } from 'react';

export type NodeRenderer = (
  node: Record<string, any>,
  key: string,
  children: ReactNode[] | null,
) => ReactNode;

export type RendererRegistry = Map<string, NodeRenderer>;

export interface LexicalRendererContext {
  extra?: Record<string, unknown>;
}

export interface HeadlessRenderContext extends LexicalRendererContext {
  children: ReactNode[] | null;
  key: string;
  variant?: 'default' | 'chat';
}

export interface HeadlessRenderableNode {
  renderHeadless(context: HeadlessRenderContext): ReactNode;
}

export interface LexicalRendererProps {
  as?: keyof JSX.IntrinsicElements;
  className?: string;
  extraNodes?: Array<Klass<LexicalNode>>;
  overrides?: Record<string, NodeRenderer>;
  renderContext?: LexicalRendererContext;
  style?: CSSProperties;
  value: SerializedEditorState;
  variant?: 'default' | 'chat';
}
