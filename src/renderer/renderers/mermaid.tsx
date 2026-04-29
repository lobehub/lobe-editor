'use client';

import { type ReactNode } from 'react';

import { MermaidPreviewBlock } from './MermaidPreviewBlock';

export function renderMermaidBlock(node: Record<string, any>, key: string): ReactNode {
  const code = (node.code as string) || '';
  return <MermaidPreviewBlock blockKey={key} code={code} key={key} />;
}
