/* eslint-disable @typescript-eslint/no-use-before-define */
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
import { BaselineIcon, EditIcon, ExternalLinkIcon, LinkIcon, UnlinkIcon } from 'lucide-react';
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useLexicalEditor } from '@/editor-kernel/react';
import { useTranslation } from '@/editor-kernel/react/useTranslation';
import { $getNearestNodeFromDOMNode } from '@/editor-kernel/utils';
import { getSelectedNode } from '@/plugins/link/utils';
import { cleanPosition } from '@/utils/updatePosition';

import {
  $isLinkToolbarNode,
  convertLinkNodeByKeyToSchema,
  convertLinkToolbarNodeByKeyToLink,
  getLinkToolbarCapabilities,
  replaceNodeByKeyWithCardNode,
  replaceNodeByKeyWithIframeNode,
} from '../../conversion';
import { $isLinkCardNode } from '../../node/LinkCardNode';
import { $isLinkIframeNode } from '../../node/LinkIframeNode';
import {
  $isLinkNode,
  HOVER_LINK_COMMAND,
  HOVER_OUT_LINK_COMMAND,
  LinkNode,
  TOGGLE_LINK_COMMAND,
} from '../../node/LinkNode';
import { LinkService, LinkToolbarNode, getNodeUrl } from '../../service/i-link-service';
import { styles } from '../style';
import { EDIT_LINK_COMMAND } from './LinkEdit';

interface LinkToolbarProps {
  editor: LexicalEditor;
  enable: boolean;
  linkService: LinkService | null;
}

const LinkToolbar = memo<LinkToolbarProps>(({ editor, enable, linkService }) => {
  const divRef = useRef<HTMLDivElement>(null);
  const LinkRef = useRef<HTMLDivElement>(null);
  const [toolbarNode, setToolbarNode] = useState<LinkToolbarNode | null>(null);
  const state = useRef<{ isLink: boolean }>({ isLink: false });
  const t = useTranslation();
  const clearTimerRef = useRef<ReturnType<typeof setTimeout> | number>(-1);

  const handleEdit = useCallback(() => {
    if (!toolbarNode || !$isLinkNode(toolbarNode)) return;
    editor.dispatchCommand(EDIT_LINK_COMMAND, {
      linkNode: toolbarNode,
      linkNodeDOM: editor.getElementByKey(toolbarNode.getKey()),
    });
  }, [editor, toolbarNode]);

  const handleCancel = useCallback(() => {
    clearTimeout(clearTimerRef.current);
    cleanPosition(divRef.current);
  }, []);

  const positionToolbar = useCallback((reference: HTMLElement) => {
    const floating = divRef.current;
    if (!floating) return;
    LinkRef.current = reference as HTMLDivElement;

    const referenceRect = reference.getBoundingClientRect();
    const floatingRect = floating.getBoundingClientRect();
    const viewportPadding = 8;
    const offset = 4;
    const maxLeft = window.innerWidth - floatingRect.width - viewportPadding;
    const left = Math.min(
      Math.max(referenceRect.left, viewportPadding),
      Math.max(maxLeft, viewportPadding),
    );
    const topAbove = referenceRect.top - floatingRect.height - offset;
    const topBelow = referenceRect.bottom + offset;
    const top = topAbove >= viewportPadding ? topAbove : topBelow;

    floating.style.left = `${left}px`;
    floating.style.top = `${Math.max(top, viewportPadding)}px`;
  }, []);

  const scheduleCancel = useCallback(() => {
    clearTimeout(clearTimerRef.current);
    clearTimerRef.current = setTimeout(handleCancel, 700);
  }, [handleCancel]);

  useEffect(() => {
    if (!enable) handleCancel();
  }, [enable, handleCancel]);

  const handleRemove = useCallback(() => {
    if (!toolbarNode || !$isLinkNode(toolbarNode)) return;
    editor.update(() => {
      const node = $getNodeByKey(toolbarNode.getKey());
      if (!$isLinkNode(node)) return;

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

      const children = node.getChildren();
      for (const child of children) {
        node.insertBefore(child);
      }
      node.remove();
    });
  }, [editor, toolbarNode]);

  const handleOpenLink = useCallback(() => {
    if (!toolbarNode) return;
    const url = editor.getEditorState().read(() => getNodeUrl(toolbarNode));
    window.open(url, '_blank');
  }, [editor, toolbarNode]);

  const convertToLink = useCallback(() => {
    if (!toolbarNode) return;
    convertLinkToolbarNodeByKeyToLink(editor, toolbarNode.getKey());
    handleCancel();
  }, [editor, handleCancel, toolbarNode]);

  const convertToCard = useCallback(() => {
    if (!toolbarNode || !linkService) return;
    replaceNodeByKeyWithCardNode(editor, toolbarNode.getKey(), linkService);
    handleCancel();
  }, [editor, handleCancel, linkService, toolbarNode]);

  const convertToIframe = useCallback(() => {
    if (!toolbarNode || !linkService) return;
    replaceNodeByKeyWithIframeNode(editor, toolbarNode.getKey(), linkService);
    handleCancel();
  }, [editor, handleCancel, linkService, toolbarNode]);

  const convertToSchema = useCallback(() => {
    if (!toolbarNode || !linkService || !$isLinkNode(toolbarNode)) return;
    convertLinkNodeByKeyToSchema(editor, toolbarNode.getKey(), linkService);
    handleCancel();
  }, [editor, handleCancel, linkService, toolbarNode]);

  useLexicalEditor(
    (editor) => {
      let rootElement = editor.getRootElement();
      const handleMouseOver = (event: MouseEvent) => {
        if (!enable) return;
        if (!editor.isEditable()) return;
        if (divRef.current === null) return;
        const reference = getLinkReferenceElement(event.target);
        if (!reference || !rootElement?.contains(reference)) return;
        if (event.relatedTarget instanceof Node && reference.contains(event.relatedTarget)) return;

        const node = editor
          .getEditorState()
          .read(() => $getNearestLinkToolbarNodeFromDOMNode(reference, editor));
        if (!node) return;

        reference.classList.add('hover');
        clearTimeout(clearTimerRef.current);
        setToolbarNode(node);
        positionToolbar(reference);
      };
      const handleMouseOut = (event: MouseEvent) => {
        const reference = getLinkReferenceElement(event.target);
        if (!reference || !rootElement?.contains(reference)) return;
        if (event.relatedTarget instanceof Node && reference.contains(event.relatedTarget)) return;
        if (event.relatedTarget instanceof Node && divRef.current?.contains(event.relatedTarget)) {
          return;
        }

        reference.classList.remove('hover');
        scheduleCancel();
      };
      const removeDocumentMouseListeners =
        typeof document === 'undefined'
          ? undefined
          : (() => {
              document.addEventListener('mouseover', handleMouseOver, true);
              document.addEventListener('mouseout', handleMouseOut, true);
              return () => {
                document.removeEventListener('mouseover', handleMouseOver, true);
                document.removeEventListener('mouseout', handleMouseOut, true);
              };
            })();

      return mergeRegister(
        editor.registerRootListener((nextRootElement, prevRootElement) => {
          prevRootElement?.removeEventListener('mouseover', handleMouseOver);
          prevRootElement?.removeEventListener('mouseout', handleMouseOut);
          rootElement = nextRootElement;
          nextRootElement?.addEventListener('mouseover', handleMouseOver);
          nextRootElement?.addEventListener('mouseout', handleMouseOut);
        }),
        removeDocumentMouseListeners || (() => {}),
        () => {
          rootElement?.removeEventListener('mouseover', handleMouseOver);
          rootElement?.removeEventListener('mouseout', handleMouseOut);
        },
        editor.registerUpdateListener(() => {
          const selection = editor.getEditorState().read(() => $getSelection());
          if (!selection) return;
          if ($isRangeSelection(selection)) {
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
            if (!editor.isEditable()) return false;
            if (!$isLinkToolbarNode(payload.node)) return false;
            if (!payload.event.target || divRef.current === null) return false;
            const reference = getLinkReferenceElement(payload.event.target);
            if (!reference) return false;
            clearTimeout(clearTimerRef.current);
            setToolbarNode(payload.node);
            positionToolbar(reference);
            return false;
          },
          COMMAND_PRIORITY_NORMAL,
        ),
        editor.registerCommand(
          HOVER_OUT_LINK_COMMAND,
          (payload) => {
            if (
              payload.event.relatedTarget instanceof Node &&
              divRef.current?.contains(payload.event.relatedTarget)
            ) {
              return false;
            }
            scheduleCancel();
            return true;
          },
          COMMAND_PRIORITY_NORMAL,
        ),
      );
    },
    [enable, positionToolbar, scheduleCancel],
  );

  const items = useMemo(() => {
    if (!toolbarNode) return [];
    const labels = linkService?.getLabels();
    const capabilities = editor
      .getEditorState()
      .read(() => getLinkToolbarCapabilities(toolbarNode, editor, linkService));
    const result = [];

    if ($isLinkNode(toolbarNode)) {
      result.push({
        icon: EditIcon,
        key: 'edit',
        label: t('link.edit'),
        onClick: handleEdit,
      });
    }

    result.push({
      icon: ExternalLinkIcon,
      key: 'openLink',
      label: t('link.open'),
      onClick: handleOpenLink,
    });

    if (capabilities.canConvertToCard && $isLinkNode(toolbarNode)) {
      result.push({
        icon: BaselineIcon,
        key: 'convertToCard',
        label: labels?.convertToCard || 'Convert to card',
        onClick: convertToCard,
      });
    }

    if (capabilities.canConvertToIframe && $isLinkNode(toolbarNode)) {
      result.push({
        icon: ExternalLinkIcon,
        key: 'convertToIframe',
        label: labels?.convertToIframe || 'Convert to iframe',
        onClick: convertToIframe,
      });
    }

    if (capabilities.canConvertToIframe && $isLinkCardNode(toolbarNode)) {
      result.push({
        icon: ExternalLinkIcon,
        key: 'convertCardToIframe',
        label: labels?.convertToIframe || 'Convert to iframe',
        onClick: convertToIframe,
      });
    }

    if (capabilities.canConvertToCard && $isLinkIframeNode(toolbarNode)) {
      result.push({
        icon: BaselineIcon,
        key: 'convertIframeToCard',
        label: labels?.convertToCard || 'Convert to card',
        onClick: convertToCard,
      });
    }

    if (capabilities.canConvertToSchema) {
      result.push({
        icon: LinkIcon,
        key: 'convertToSchema',
        label: labels?.convertToSchema || 'Convert to schema',
        onClick: convertToSchema,
      });
    }

    if (capabilities.canConvertToLink) {
      result.push({
        icon: LinkIcon,
        key: 'convertToLink',
        label: labels?.convertToLink || 'Convert to link',
        onClick: convertToLink,
      });
    }

    if ($isLinkNode(toolbarNode)) {
      result.push({
        icon: UnlinkIcon,
        key: 'unlink',
        label: t('link.unlink'),
        onClick: () => {
          handleRemove();
          handleCancel();
        },
      });
    }

    if (linkService) {
      result.push(
        ...linkService.getToolbarActions({ editor, node: toolbarNode }).map((action) => ({
          icon: action.icon as any,
          key: action.key,
          label: action.label,
          onClick: () => {
            action.onClick({ editor, node: toolbarNode });
            handleCancel();
          },
        })),
      );
    }

    return result;
  }, [
    convertToCard,
    convertToIframe,
    convertToLink,
    convertToSchema,
    editor,
    handleCancel,
    handleEdit,
    handleOpenLink,
    handleRemove,
    linkService,
    t,
    toolbarNode,
  ]);

  useEffect(() => {
    if (!toolbarNode || items.length === 0 || !LinkRef.current) return;
    positionToolbar(LinkRef.current);
  }, [items.length, positionToolbar, toolbarNode]);

  return (
    <div
      className={styles.linkToolbar}
      onMouseDown={(event) => {
        clearTimeout(clearTimerRef.current);
        event.preventDefault();
        event.stopPropagation();
      }}
      onMouseEnter={() => {
        clearTimeout(clearTimerRef.current);
      }}
      onMouseLeave={() => {
        scheduleCancel();
      }}
      onMouseMove={() => {
        clearTimeout(clearTimerRef.current);
      }}
      ref={divRef}
    >
      <ActionIconGroup
        items={items}
        onActionClick={({ domEvent }) => {
          clearTimeout(clearTimerRef.current);
          domEvent.preventDefault();
          domEvent.stopPropagation();
        }}
        shadow
        size={{
          blockSize: 32,
          size: 16,
        }}
        variant={'outlined'}
      />
    </div>
  );
});

function $getNearestLinkToolbarNodeFromDOMNode(
  startingDOM: Node,
  editor: LexicalEditor,
): LinkToolbarNode | null {
  let node = $getNearestNodeFromDOMNode(startingDOM, editor);
  while (node) {
    if ($isLinkToolbarNode(node)) return node;
    node = node.getParent();
  }
  return null;
}

function getLinkReferenceElement(target: EventTarget | null): HTMLElement | null {
  if (!(target instanceof Element)) return null;
  return target.closest<HTMLElement>(
    'a, [data-link-card="true"], [data-link-iframe="true"], [data-schema-link="true"]',
  );
}

LinkToolbar.displayName = 'LinkToolbar';

export default LinkToolbar;
