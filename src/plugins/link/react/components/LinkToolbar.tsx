import { ActionIconGroup, type ActionIconGroupProps } from '@lobehub/ui';
import { LexicalEditor } from 'lexical';
import { EditIcon, ExternalLinkIcon, UnlinkIcon } from 'lucide-react';
import { memo } from 'react';

import { useTranslation } from '@/editor-kernel/react/useTranslation';

import { LinkNode, TOGGLE_LINK_COMMAND } from '../../node/LinkNode';
import { useStyles } from '../style';
import { EDIT_LINK_COMMAND } from './LinkEdit';

interface LinkToolbarProps extends Omit<ActionIconGroupProps, 'items'> {
  editor: LexicalEditor;
  linkNode: LinkNode | null;
}

const LinkToolbar = memo<LinkToolbarProps>(({ linkNode, editor, ...rest }) => {
  const { styles } = useStyles();
  const t = useTranslation();

  const handleEdit = () => {
    // Edit link
    if (linkNode) {
      editor.dispatchCommand(EDIT_LINK_COMMAND, {
        linkNode,
        linkNodeDOM: editor.getElementByKey(linkNode.getKey()),
      });
    }
  };

  const handleRemove = () => {
    // Remove link
    editor.dispatchCommand(TOGGLE_LINK_COMMAND, null);
  };

  const handleOpenLink = () => {
    // Open link in new window
    if (linkNode) {
      const url = editor.read(() => linkNode.getURL());
      window.open(url, '_blank');
    }
  };

  return (
    <ActionIconGroup
      className={styles.linkToolbar}
      items={[
        {
          icon: EditIcon,
          key: 'edit',
          label: t('link.edit'),
          onClick: handleEdit,
        },
        {
          icon: ExternalLinkIcon,
          key: 'openLink',
          label: t('link.open'),
          onClick: handleOpenLink,
        },
        {
          icon: UnlinkIcon,
          key: 'unlink',
          label: t('link.unlink'),
          onClick: handleRemove,
        },
      ]}
      shadow
      size={{
        blockSize: 32,
        size: 16,
      }}
      variant={'outlined'}
      {...rest}
    />
  );
});

export default LinkToolbar;
