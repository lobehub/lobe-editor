import { Icon } from '@lobehub/ui';
import { LexicalEditor } from 'lexical';
import * as LucideIcon from 'lucide-react';
import type { FC } from 'react';

import { LinkNode, TOGGLE_LINK_COMMAND } from '../node/LinkNode';
import { EDIT_LINK_COMMAND } from './edit';
import { useStyles } from './style';

export const Toolbar: FC<{ editor: LexicalEditor; linkNode: LinkNode | null }> = ({
  linkNode,
  editor,
}) => {
  const { styles } = useStyles();

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
    <div className={styles.editor_linkToolbar}>
      <div className={styles.editor_linkToolbar_item} onClick={handleEdit} title="编辑链接">
        <Icon icon={LucideIcon.Edit} size={16} />
      </div>
      <div className={styles.editor_linkToolbar_item} onClick={handleOpenLink} title="打开链接">
        <Icon icon={LucideIcon.ExternalLink} size={16} />
      </div>
      <div className={styles.editor_linkToolbar_item} onClick={handleRemove} title="移除链接">
        <Icon icon={LucideIcon.Unlink} size={16} />
      </div>
    </div>
  );
};
