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
import { useEditable } from '@/editor-kernel/react/useEditable';
import { useTranslation } from '@/editor-kernel/react/useTranslation';
import { getSelectedNode } from '@/plugins/link/utils';
import { cleanPosition, updatePosition } from '@/utils/updatePosition';

import {
  $isLinkNode,
  HOVER_LINK_COMMAND,
  HOVER_OUT_LINK_COMMAND,
  LinkNode,
  TOGGLE_LINK_COMMAND,
} from '../../node/LinkNode';
import { styles } from '../style';
import { EDIT_LINK_COMMAND } from './LinkEdit';

interface LinkToolbarProps {
  editor: LexicalEditor;
  enable: boolean;
}

const LinkToolbar = memo<LinkToolbarProps>(({ editor, enable }) => {
  const divRef = useRef<HTMLDivElement>(null);
  const LinkRef = useRef<HTMLDivElement>(null);
  const [linkNode, setLinkNode] = useState<LinkNode | null>(null);
  const state = useRef<{ isLink: boolean }>({ isLink: false });
  const t = useTranslation();
  const clearTimerRef = useRef<ReturnType<typeof setTimeout> | number>(-1);
  const { editable } = useEditable();

  const handleEdit = useCallback(() => {
    if (!linkNode) return;
    editor.dispatchCommand(EDIT_LINK_COMMAND, {
      linkNode,
      linkNodeDOM: editor.getElementByKey(linkNode.getKey()),
    });
  }, [editor, linkNode]);

  const handleCancel = useCallback(() => {
    clearTimeout(clearTimerRef.current);
    cleanPosition(divRef.current);
  }, []);

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
    const url = editor.getEditorState().read(() => linkNode.getURL());
    window.open(url, '_blank');
  }, [editor, linkNode]);

  useLexicalEditor(
    (editor) => {
      if (!editable) return;
      return mergeRegister(
        editor.registerUpdateListener(() => {
          const selection = editor.getEditorState().read(() => $getSelection());
          if (!selection) return;
          if ($isRangeSelection(selection)) {
            // Update links for UI components
            editor.getEditorState().read(() => {
              const node = getSelectedNode(selection);
              const parent = node.getParent();
              const isLink = $isLinkNode(parent) || $isLinkNode(node);
              if (isLink === state.current.isLink) return;
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
            if (!enable) return false;
            if (!payload.event.target || divRef.current === null) return false;
            // Cancel any pending hide timers when hovering a link again
            clearTimeout(clearTimerRef.current);
            setLinkNode(payload.linkNode);
            updatePosition({
              callback: () => {
                LinkRef.current = payload.event.target as HTMLDivElement;
              },
              floating: divRef.current,
              offset: 4,
              placement: 'top-start',
              reference: payload.event.target as HTMLElement,
            });
            return false;
          },
          COMMAND_PRIORITY_NORMAL,
        ),
        editor.registerCommand(
          HOVER_OUT_LINK_COMMAND,
          () => {
            clearTimerRef.current = setTimeout(handleCancel, 300);
            return true;
          },
          COMMAND_PRIORITY_NORMAL,
        ),
      );
    },
    [enable, editable],
  );

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
            handleCancel();
          },
        },
      ]}
      onMouseEnter={() => {
        clearTimeout(clearTimerRef.current);
      }}
      onMouseLeave={() => {
        handleCancel();
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
