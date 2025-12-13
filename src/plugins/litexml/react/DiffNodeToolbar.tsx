import { LexicalEditor } from 'lexical';
import { memo } from 'react';

import { LexicalPortalContainer } from '@/editor-kernel/react';

import { DiffNode } from '../node/DiffNode';

interface ReactDiffNodeToolbarProps {
  className?: string;
  editor: LexicalEditor;
  node: DiffNode;
}

const ReactDiffNodeToolbar = memo<ReactDiffNodeToolbarProps>(({ editor, node }) => {
  return (
    <LexicalPortalContainer editor={editor} node={node}>
      <div>123123</div>
    </LexicalPortalContainer>
  );
});

ReactDiffNodeToolbar.displayName = 'ReactDiffNodeToolbar';

export default ReactDiffNodeToolbar;
