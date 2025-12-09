import { LexicalEditor } from 'lexical';
import { memo } from 'react';

import { DiffNode } from '../node/DiffNode';

interface ReactDiffNodeToolbarProps {
  className?: string;
  editor: LexicalEditor;
  node: DiffNode;
}

const ReactDiffNodeToolbar = memo<ReactDiffNodeToolbarProps>(({ className }) => {
  return <div className={className}>123</div>;
});

ReactDiffNodeToolbar.displayName = 'ReactDiffNodeToolbar';

export default ReactDiffNodeToolbar;
