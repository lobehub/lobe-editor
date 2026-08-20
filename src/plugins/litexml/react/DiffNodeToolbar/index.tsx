import { ActionIcon, Block } from '@lobehub/ui';
import { useThemeMode } from 'antd-style';
import type { LexicalEditor } from 'lexical';
import { Check, X } from 'lucide-react';
import type { FC, PointerEvent as ReactPointerEvent } from 'react';

import { LexicalPortalContainer } from '@/editor-kernel/react';
import { useTranslation } from '@/editor-kernel/react/useTranslation';

import { DiffAction, LITEXML_DIFFNODE_COMMAND } from '../../command/diffCommand';
import type { DiffNode } from '../../node/DiffNode';
import { styles } from './style';

interface ReactDiffNodeToolbarProps {
  className?: string;
  editor: LexicalEditor;
  node: DiffNode;
}

const ReactDiffNodeToolbar: FC<ReactDiffNodeToolbarProps> = ({ editor, node }) => {
  const t = useTranslation();
  const { isDarkMode } = useThemeMode();
  const handleActionPointerDown = (event: ReactPointerEvent, action: DiffAction) => {
    // A pointer down inside a content-editable table can move the Lexical selection
    // and unmount this hover toolbar before click fires. Resolve the diff immediately.
    event.preventDefault();
    event.stopPropagation();
    editor.dispatchCommand(LITEXML_DIFFNODE_COMMAND, {
      action,
      nodeKey: node.getKey(),
    });
  };

  return (
    <LexicalPortalContainer editor={editor} node={node}>
      <Block
        className={isDarkMode ? styles.toolbarDark : styles.toolbarLight}
        gap={2}
        horizontal
        padding={2}
        shadow
        variant={'outlined'}
      >
        <ActionIcon
          aria-label="Reject change"
          className={styles.reject}
          danger
          icon={X}
          onPointerDown={(event) => handleActionPointerDown(event, DiffAction.Reject)}
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
          onPointerDown={(event) => handleActionPointerDown(event, DiffAction.Accept)}
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
