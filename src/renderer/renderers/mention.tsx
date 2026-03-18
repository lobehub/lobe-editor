import type { ReactNode } from 'react';

import { getMentionClassName } from '../style';

export function renderMention(node: Record<string, any>, key: string): ReactNode {
  const label = (node.label as string) || '';
  return (
    <span className={getMentionClassName()} key={key}>
      <span className="editor_mention">@{label}</span>
    </span>
  );
}
