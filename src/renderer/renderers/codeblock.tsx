'use client';

import { Highlighter } from '@lobehub/ui';
import { type ReactNode } from 'react';

import { renderMermaidBlock } from './mermaid';

function CodeBlockRenderer({ node }: { node: Record<string, any> }) {
  const language = (node.language as string) || '';
  const code = (node.code as string) || '';

  return (
    <Highlighter defaultExpand language={language || 'text'} variant="filled">
      {code}
    </Highlighter>
  );
}

export function renderCodeBlock(node: Record<string, any>, key: string): ReactNode {
  const language = ((node.language as string) || '').toLowerCase();
  if (language === 'mermaid') {
    return renderMermaidBlock(node, key);
  }

  return <CodeBlockRenderer key={key} node={node} />;
}
