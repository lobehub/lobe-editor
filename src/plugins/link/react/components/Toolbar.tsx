import { ActionIconGroup } from '@lobehub/ui';
import { LexicalEditor } from 'lexical';
import { EditIcon, ExternalLinkIcon, UnlinkIcon } from 'lucide-react';
import type { FC } from 'react';

import { LinkNode, TOGGLE_LINK_COMMAND } from '../../node/LinkNode';
import { useStyles } from '../style';
import { EDIT_LINK_COMMAND } from './LinkEdit';

export const Toolbar: FC<{ editor: LexicalEditor; linkNode: LinkNode | null }> = ({
  linkNode,
  editor,
}) => {
  const { theme } = useStyles();

  const handleEdit = () => {
    // 编辑链接
    if (linkNode) {
      editor.dispatchCommand(EDIT_LINK_COMMAND, {
        linkNode,
        linkNodeDOM: editor.getElementByKey(linkNode.getKey()),
      });
    }
  };

  const handleRemove = () => {
    // 移除链接
    editor.dispatchCommand(TOGGLE_LINK_COMMAND, null);
  };

  const handleOpenLink = () => {
    // 在新窗口打开链接
    if (linkNode) {
      const url = editor.read(() => linkNode.getURL());
      window.open(url, '_blank');
    }
  };

  return (
    <ActionIconGroup
      items={[
        {
          icon: EditIcon,
          key: 'edit',
          label: 'Edit',
          onClick: handleEdit,
        },
        {
          icon: ExternalLinkIcon,
          key: 'openLink',
          label: 'Open Link',
          onClick: handleOpenLink,
        },
        {
          icon: UnlinkIcon,
          key: 'unlink',
          label: 'Unlink',
          onClick: handleRemove,
        },
      ]}
      shadow
      size={{
        blockSize: 32,
        size: 16,
      }}
      style={{
        background: theme.colorBgElevated,
      }}
      variant={'outlined'}
    />
  );
};
