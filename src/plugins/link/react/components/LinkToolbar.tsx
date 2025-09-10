import { ActionIconGroup, type ActionIconGroupProps } from '@lobehub/ui';
import {
  $createRangeSelection,
  $getNodeByKey,
  $getSelection,
  $isRangeSelection,
  $isTextNode,
  $setSelection,
  LexicalEditor,
} from 'lexical';
import { EditIcon, ExternalLinkIcon, UnlinkIcon } from 'lucide-react';
import { memo, useCallback } from 'react';

import { useTranslation } from '@/editor-kernel/react/useTranslation';

import { $isLinkNode, LinkNode, TOGGLE_LINK_COMMAND } from '../../node/LinkNode';
import { useStyles } from '../style';
import { EDIT_LINK_COMMAND } from './LinkEdit';

interface LinkToolbarProps extends Omit<ActionIconGroupProps, 'items'> {
  editor: LexicalEditor;
  linkNode: LinkNode | null;
}

const LinkToolbar = memo<LinkToolbarProps>(({ linkNode, editor, onMouseLeave, ...rest }) => {
  const { styles } = useStyles();
  const t = useTranslation();

  const handleEdit = useCallback(() => {
    if (!linkNode) return;
    editor.dispatchCommand(EDIT_LINK_COMMAND, {
      linkNode,
      linkNodeDOM: editor.getElementByKey(linkNode.getKey()),
    });
  }, [editor, linkNode]);

  const handleRemove = useCallback(() => {
    if (!linkNode) return;
    editor.update(() => {
      const node = $getNodeByKey(linkNode.getKey());
      if (!$isLinkNode(node)) return;

      // Try to create a range selection that covers the link's text
      let selection = $getSelection();
      if (!selection || !$isRangeSelection(selection)) {
        $setSelection($createRangeSelection());
        selection = $getSelection();
      }

      const first = node.getFirstDescendant();
      const last = node.getLastDescendant();

      if (selection && $isRangeSelection(selection) && $isTextNode(first) && $isTextNode(last)) {
        selection.anchor.set(first.getKey(), 0, 'text');
        selection.focus.set(last.getKey(), last.getTextContentSize(), 'text');
        editor.dispatchCommand(TOGGLE_LINK_COMMAND, null);
        return;
      }

      // Fallback: directly unwrap the link node preserving its children
      const children = node.getChildren();
      for (const child of children) {
        node.insertBefore(child);
      }
      node.remove();
    });
  }, [editor, linkNode]);

  const handleOpenLink = useCallback(() => {
    if (!linkNode) return;
    const url = editor.read(() => linkNode.getURL());
    window.open(url, '_blank');
  }, [editor, linkNode]);

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
          onClick: (e) => {
            handleRemove();
            onMouseLeave?.(e as any);
          },
        },
      ]}
      onMouseLeave={onMouseLeave}
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
