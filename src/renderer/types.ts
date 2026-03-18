import type { Klass, LexicalNode, SerializedEditorState } from 'lexical';
import type { CSSProperties, JSX, ReactNode } from 'react';

export type NodeRenderer = (
  node: Record<string, any>,
  key: string,
  children: ReactNode[] | null,
) => ReactNode;

export type RendererRegistry = Map<string, NodeRenderer>;

export interface LexicalRendererProps {
  as?: keyof JSX.IntrinsicElements;
  className?: string;
  extraNodes?: Array<Klass<LexicalNode>>;
  overrides?: Record<string, NodeRenderer>;
  style?: CSSProperties;
  value: SerializedEditorState;
  variant?: 'default' | 'chat';
}
