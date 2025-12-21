import { ActionIcon, Block } from '@lobehub/ui';
import { LexicalEditor } from 'lexical';
import { Check, X } from 'lucide-react';
import type { FC } from 'react';

import { LexicalPortalContainer } from '@/editor-kernel/react';
import { useTranslation } from '@/editor-kernel/react/useTranslation';

import { DiffAction, LITEXML_DIFFNODE_COMMAND } from '../../command/diffCommand';
import { DiffNode } from '../../node/DiffNode';
import { useStyles } from './style';

interface ReactDiffNodeToolbarProps {
  className?: string;
  editor: LexicalEditor;
  node: DiffNode;
}

const ReactDiffNodeToolbar: FC<ReactDiffNodeToolbarProps> = ({ editor, node }) => {
  const t = useTranslation();
  const { styles } = useStyles();
  return (
    <LexicalPortalContainer editor={editor} node={node}>
      <Block className={styles.toolbar} gap={2} horizontal padding={2} shadow variant={'outlined'}>
        <ActionIcon
          aria-label="Reject change"
          className={styles.reject}
          danger
          icon={X}
          onClick={() => {
            editor.dispatchCommand(LITEXML_DIFFNODE_COMMAND, {
              action: DiffAction.Reject,
              nodeKey: node.getKey(),
            });
          }}
          size={{
            blockSize: 28,
            size: 16,
          }}
          title={t('modifier.reject')}
        />
        <ActionIcon
          aria-label="Accept change"
          className={styles.accept}
          icon={Check}
          onClick={() => {
            editor.dispatchCommand(LITEXML_DIFFNODE_COMMAND, {
              action: DiffAction.Accept,
              nodeKey: node.getKey(),
            });
          }}
          size={{
            blockSize: 28,
            size: 16,
          }}
          title={t('modifier.accept')}
        />
      </Block>
    </LexicalPortalContainer>
  );
};

ReactDiffNodeToolbar.displayName = 'ReactDiffNodeToolbar';

export default ReactDiffNodeToolbar;
