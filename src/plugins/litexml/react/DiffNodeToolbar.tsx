import { LexicalEditor } from 'lexical';
import { Check, X } from 'lucide-react';
import { memo } from 'react';

import { LexicalPortalContainer } from '@/editor-kernel/react';

import { DiffAction, LITEXML_DIFFNODE_COMMAND } from '../command/diffCommand';
import { DiffNode } from '../node/DiffNode';

interface ReactDiffNodeToolbarProps {
  className?: string;
  editor: LexicalEditor;
  node: DiffNode;
}

const ReactDiffNodeToolbar = memo<ReactDiffNodeToolbarProps>(({ editor, node }) => {
  return (
    <LexicalPortalContainer editor={editor} node={node}>
      <button
        aria-label="Accept change"
        className={`toolbarButton accept`}
        onClick={() => {
          console.log('Accept change');
          editor.dispatchCommand(LITEXML_DIFFNODE_COMMAND, {
            action: DiffAction.Accept,
            nodeKey: node.getKey(),
          });
        }}
        title="Accept"
        type="button"
      >
        <Check size={16} />
      </button>
      <button
        aria-label="Reject change"
        className={`toolbarButton reject`}
        onClick={() => {
          console.log('Reject change');
          editor.dispatchCommand(LITEXML_DIFFNODE_COMMAND, {
            action: DiffAction.Reject,
            nodeKey: node.getKey(),
          });
        }}
        title="Reject"
        type="button"
      >
        <X size={16} />
      </button>
    </LexicalPortalContainer>
  );
});

ReactDiffNodeToolbar.displayName = 'ReactDiffNodeToolbar';

export default ReactDiffNodeToolbar;
