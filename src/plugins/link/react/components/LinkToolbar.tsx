import { computePosition, flip, offset, shift } from '@floating-ui/dom';
import { mergeRegister } from '@lexical/utils';
import { ActionIconGroup } from '@lobehub/ui';
import {
  $createRangeSelection,
  $getNodeByKey,
  $getSelection,
  $isRangeSelection,
  $isTextNode,
  $setSelection,
  COMMAND_PRIORITY_NORMAL,
  LexicalEditor,
} from 'lexical';
import { EditIcon, ExternalLinkIcon, UnlinkIcon } from 'lucide-react';
import { memo, useCallback, useRef, useState } from 'react';

import { useLexicalEditor } from '@/editor-kernel/react';
import { useTranslation } from '@/editor-kernel/react/useTranslation';
import { getSelectedNode } from '@/plugins/link/utils';

import {
  $isLinkNode,
  HOVER_LINK_COMMAND,
  HOVER_OUT_LINK_COMMAND,
  LinkNode,
  TOGGLE_LINK_COMMAND,
} from '../../node/LinkNode';
import { useStyles } from '../style';
import { EDIT_LINK_COMMAND } from './LinkEdit';

interface LinkToolbarProps {
  editor: LexicalEditor;
}

const LinkToolbar = memo<LinkToolbarProps>(({ editor }) => {
  const divRef = useRef<HTMLDivElement>(null);
  const LinkRef = useRef<HTMLDivElement>(null);
  const { styles } = useStyles();
  const [linkNode, setLinkNode] = useState<LinkNode | null>(null);
  const state = useRef<{ isLink: boolean }>({ isLink: false });
  const t = useTranslation();
  const clearTimerRef = useRef<ReturnType<typeof setTimeout> | number>(-1);

  useLexicalEditor((editor) => {
    return mergeRegister(
      editor.registerUpdateListener(() => {
        const selection = editor.read(() => $getSelection());
        if (!selection) return;
        if ($isRangeSelection(selection)) {
          // Update links for UI components
          editor.read(() => {
            const node = getSelectedNode(selection);
            const parent = node.getParent();
            const isLink = $isLinkNode(parent) || $isLinkNode(node);
            state.current.isLink = isLink;
            if (isLink) {
              const linkNode = $isLinkNode(parent) ? (parent as LinkNode) : (node as LinkNode);
              editor.dispatchCommand(EDIT_LINK_COMMAND, {
                linkNode,
                linkNodeDOM: editor.getElementByKey(linkNode.getKey()),
              });
            } else {
              editor.dispatchCommand(EDIT_LINK_COMMAND, {
                linkNode: null,
                linkNodeDOM: null,
              });
            }
          });
        } else {
          state.current.isLink = false;
        }
      }),
      editor.registerCommand(
        HOVER_LINK_COMMAND,
        (payload) => {
          if (!payload.event.target || divRef.current === null) {
            return false;
          }
          // Cancel any pending hide timers when hovering a link again
          clearTimeout(clearTimerRef.current);
          setLinkNode(payload.linkNode);
          computePosition(payload.event.target as HTMLElement, divRef.current, {
            middleware: [offset(5), flip(), shift()],
            placement: 'top-start',
          }).then(({ x, y }) => {
            if (!payload.event.target || divRef.current === null) {
              return false;
            }
            LinkRef.current = payload.event.target as HTMLDivElement;
            divRef.current.style.left = `${x}px`;
            divRef.current.style.top = `${y}px`;
          });
          return false;
        },
        COMMAND_PRIORITY_NORMAL,
      ),
      editor.registerCommand(
        HOVER_OUT_LINK_COMMAND,
        () => {
          clearTimeout(clearTimerRef.current);
          clearTimerRef.current = setTimeout(() => {
            if (divRef.current) {
              divRef.current.style.left = '-9999px';
              divRef.current.style.top = '-9999px';
            }
          }, 300);
          return true;
        },
        COMMAND_PRIORITY_NORMAL,
      ),
    );
  }, []);

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
          onClick: () => {
            handleRemove();
            clearTimeout(clearTimerRef.current);
            if (divRef.current) {
              divRef.current.style.left = '-9999px';
              divRef.current.style.top = '-9999px';
            }
          },
        },
      ]}
      onMouseEnter={() => {
        clearTimeout(clearTimerRef.current);
      }}
      onMouseLeave={() => {
        clearTimeout(clearTimerRef.current);
        if (divRef.current) {
          divRef.current.style.left = '-9999px';
          divRef.current.style.top = '-9999px';
        }
      }}
      ref={divRef}
      shadow
      size={{
        blockSize: 32,
        size: 16,
      }}
      variant={'outlined'}
    />
  );
});

LinkToolbar.displayName = 'LinkToolbar';

export default LinkToolbar;
