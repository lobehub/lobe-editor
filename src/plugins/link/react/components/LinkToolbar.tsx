import { mergeRegister } from '@lexical/utils';
import type { IconProps } from '@lobehub/ui';
import { Flexbox, Icon } from '@lobehub/ui';
import type { LexicalEditor, NodeKey } from 'lexical';
import { $getNodeByKey, $getSelection, $isRangeSelection, COMMAND_PRIORITY_NORMAL } from 'lexical';
import {
  CopyIcon,
  EditIcon,
  ExternalLinkIcon,
  GalleryHorizontalEndIcon,
  LinkIcon,
  PanelsTopLeftIcon,
  PanelTopOpenIcon,
  UnlinkIcon,
} from 'lucide-react';
import { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';

import { useLexicalEditor } from '@/editor-kernel/react';
import { useEditable } from '@/editor-kernel/react/useEditable';
import { useTranslation } from '@/editor-kernel/react/useTranslation';
import { $getNearestNodeFromDOMNode } from '@/editor-kernel/utils';
import { getSelectedNode } from '@/plugins/link/utils';
import type { ILocaleKeys } from '@/types';
import { cleanPosition, updatePosition } from '@/utils/updatePosition';

import {
  $isLinkToolbarNode,
  convertLinkNodeByKeyToSchema,
  convertLinkToolbarNodeByKeyToLink,
  getLinkToolbarCapabilities,
  replaceNodeByKeyWithBlockCardNode,
  replaceNodeByKeyWithCardNode,
  replaceNodeByKeyWithIframeNode,
} from '../../conversion';
import { $isLinkNode, HOVER_LINK_COMMAND, HOVER_OUT_LINK_COMMAND } from '../../node/LinkNode';
import type {
  LinkService,
  LinkToolbarItemIcon,
  LinkToolbarNode,
  LinkToolbarRenderContext,
} from '../../service/i-link-service';
import { getNodeUrl } from '../../service/i-link-service';
import { styles } from '../style';

interface LinkToolbarProps {
  editor: LexicalEditor;
  enable: boolean;
  linkService: LinkService | null;
}

interface ToolbarViewItem {
  icon: IconProps['icon'];
  key: string;
  label: string;
  onClick: () => void;
}

const HOVER_OPEN_DELAY = 180;
const HOVER_CLOSE_DELAY = 500;

const toolbarIconMap: Record<LinkToolbarItemIcon, IconProps['icon']> = {
  copy: CopyIcon,
  edit: EditIcon,
  open: ExternalLinkIcon,
  unlink: UnlinkIcon,
};

const LinkToolbar = memo<LinkToolbarProps>(({ editor, enable, linkService }) => {
  const divRef = useRef<HTMLDivElement>(null);
  const linkDomRef = useRef<HTMLElement | null>(null);
  // Lexical nodes are immutable editor-state snapshots. Holding one in React
  // state makes it stale as soon as collaboration or any other update commits.
  // Keep only the stable key and resolve the node inside the active read scope.
  const [toolbarNodeKey, setToolbarNodeKey] = useState<NodeKey | null>(null);
  const [menuVersion, setMenuVersion] = useState(0);
  const selectedLinkKeyRef = useRef<NodeKey | null>(null);
  const lastPointerActionAtRef = useRef(0);
  const toolbarHoverRef = useRef(false);
  const visibleLinkKeyRef = useRef<NodeKey | null>(null);
  const clearTimerRef = useRef<ReturnType<typeof setTimeout> | number>(-1);
  const showTimerRef = useRef<ReturnType<typeof setTimeout> | number>(-1);
  const { editable } = useEditable();
  const t = useTranslation();

  const handleCancel = useCallback(() => {
    clearTimeout(clearTimerRef.current);
    clearTimeout(showTimerRef.current);
    linkDomRef.current?.classList.remove('hover');
    linkDomRef.current = null;
    toolbarHoverRef.current = false;
    visibleLinkKeyRef.current = null;
    cleanPosition(divRef.current);
    // The same reset is shared by pointer handlers and the enable/editable
    // synchronization effect, so it belongs in this single cancellation path.
    // eslint-disable-next-line @eslint-react/hooks-extra/no-direct-set-state-in-use-effect
    setToolbarNodeKey(null);
  }, []);

  const updateToolbarPosition = useCallback(() => {
    void updatePosition({
      floating: divRef.current,
      offset: 4,
      placement: 'top-start',
      reference: linkDomRef.current,
    });
  }, []);

  const showToolbar = useCallback((nextNodeKey: NodeKey, reference: HTMLElement) => {
    clearTimeout(clearTimerRef.current);
    linkDomRef.current?.classList.remove('hover');
    linkDomRef.current = reference;
    linkDomRef.current.classList.add('hover');
    visibleLinkKeyRef.current = nextNodeKey;
    setToolbarNodeKey(nextNodeKey);
  }, []);

  const scheduleShowToolbar = useCallback(
    (nextNodeKey: NodeKey, reference: HTMLElement) => {
      clearTimeout(clearTimerRef.current);
      clearTimeout(showTimerRef.current);
      showTimerRef.current = setTimeout(() => {
        showToolbar(nextNodeKey, reference);
      }, HOVER_OPEN_DELAY);
    },
    [showToolbar],
  );

  const scheduleHideToolbar = useCallback(
    (delay = HOVER_CLOSE_DELAY) => {
      clearTimeout(clearTimerRef.current);
      clearTimerRef.current = setTimeout(() => {
        if (!toolbarHoverRef.current) handleCancel();
      }, delay);
    },
    [handleCancel],
  );

  useEffect(() => {
    if (!enable || !editable) handleCancel();
  }, [editable, enable, handleCancel]);

  useEffect(() => {
    if (!linkService) return;
    return linkService.subscribe(() => {
      setMenuVersion((version) => version + 1);
    });
  }, [linkService]);

  const resolveToolbarNodeKey = useCallback((): NodeKey | null => {
    return editor.getEditorState().read(() => {
      // Paste normalization, collaboration, and metadata hydration can commit
      // a newer editor state while the floating toolbar is still visible.
      // Resolve from the live DOM first so an action never targets a key that
      // belonged to the render which originally opened the toolbar.
      const currentNode = linkDomRef.current?.isConnected
        ? $getNearestLinkToolbarNodeFromDOMNode(linkDomRef.current, editor)
        : null;
      if (currentNode) return currentNode.getKey();

      const fallbackKey = visibleLinkKeyRef.current || toolbarNodeKey;
      if (!fallbackKey) return null;
      const fallbackNode = $getNodeByKey(fallbackKey);
      return $isLinkToolbarNode(fallbackNode) ? fallbackNode.getKey() : null;
    });
  }, [editor, toolbarNodeKey]);

  const items = useMemo<ToolbarViewItem[]>(() => {
    // Link services notify when their asynchronous metadata/actions change.
    // Reading the version here intentionally invalidates this derived menu.
    void menuVersion;
    if (!toolbarNodeKey) return [];

    return (
      readToolbarNode(editor, toolbarNodeKey, (toolbarNode) => {
        const result: ToolbarViewItem[] = [];
        const labels = linkService?.getLabels();
        const capabilities = getLinkToolbarCapabilities(toolbarNode, editor, linkService);
        const context: LinkToolbarRenderContext | null = $isLinkNode(toolbarNode)
          ? {
              close: handleCancel,
              editor,
              linkDom: linkDomRef.current,
              linkNode: toolbarNode,
            }
          : null;

        if (context && linkService) {
          result.push(
            ...linkService.getToolbarItems(context).map((item) => ({
              icon: toolbarIconMap[item.icon],
              key: item.key,
              label:
                typeof item.label === 'function'
                  ? item.label(context)
                  : t(item.label as keyof ILocaleKeys),
              onClick: () => {
                const nodeKey = resolveToolbarNodeKey();
                if (!nodeKey) return;
                readToolbarNode(editor, nodeKey, (currentNode) => {
                  if (!$isLinkNode(currentNode)) return;
                  void item.onClick({
                    close: handleCancel,
                    editor,
                    linkDom: linkDomRef.current,
                    linkNode: currentNode,
                  });
                });
              },
            })),
          );
        } else {
          const url = getNodeUrl(toolbarNode);
          result.push({
            icon: ExternalLinkIcon,
            key: 'open',
            label: t('link.open'),
            onClick: () => window.open(url, '_blank'),
          });
        }

        if (capabilities.canConvertToCard) {
          result.push({
            icon: GalleryHorizontalEndIcon,
            key: 'convertToCard',
            label: labels?.convertToCard || 'Convert to card',
            onClick: () => {
              if (!linkService) return;
              const nodeKey = resolveToolbarNodeKey();
              if (!nodeKey) return;
              void replaceNodeByKeyWithCardNode(editor, nodeKey, linkService);
              handleCancel();
            },
          });
        }

        if (capabilities.canConvertToBlockCard) {
          result.push({
            icon: PanelsTopLeftIcon,
            key: 'convertToBlockCard',
            label: labels?.convertToBlockCard || 'Convert to block card',
            onClick: () => {
              if (!linkService) return;
              const nodeKey = resolveToolbarNodeKey();
              if (!nodeKey) return;
              void replaceNodeByKeyWithBlockCardNode(editor, nodeKey, linkService);
              handleCancel();
            },
          });
        }

        if (capabilities.canConvertToIframe) {
          result.push({
            icon: PanelTopOpenIcon,
            key: 'convertToIframe',
            label: labels?.convertToIframe || 'Convert to iframe',
            onClick: () => {
              if (!linkService) return;
              const nodeKey = resolveToolbarNodeKey();
              if (!nodeKey) return;
              replaceNodeByKeyWithIframeNode(editor, nodeKey, linkService);
              handleCancel();
            },
          });
        }

        if (capabilities.canConvertToSchema && $isLinkNode(toolbarNode)) {
          result.push({
            icon: LinkIcon,
            key: 'convertToSchema',
            label: labels?.convertToSchema || 'Convert to schema',
            onClick: () => {
              if (!linkService) return;
              const nodeKey = resolveToolbarNodeKey();
              if (!nodeKey) return;
              convertLinkNodeByKeyToSchema(editor, nodeKey, linkService);
              handleCancel();
            },
          });
        }

        if (capabilities.canConvertToLink) {
          result.push({
            icon: LinkIcon,
            key: 'convertToLink',
            label: labels?.convertToLink || 'Convert to link',
            onClick: () => {
              const nodeKey = resolveToolbarNodeKey();
              if (!nodeKey) return;
              convertLinkToolbarNodeByKeyToLink(editor, nodeKey);
              // convertLinkToolbarNodeByKeyToLink selects the replacement.
              // The synchronous Lexical update listener rebinds this toolbar
              // to that new link node; cancelling here would immediately tear
              // the refreshed toolbar back down and leave the next click
              // targeting controls derived from the removed card node.
            },
          });
        }

        if (linkService) {
          result.push(
            ...linkService.getToolbarActions({ editor, node: toolbarNode }).map((action) => ({
              icon: (action.icon || LinkIcon) as IconProps['icon'],
              key: action.key,
              label: action.label,
              onClick: () => {
                const nodeKey = resolveToolbarNodeKey();
                if (!nodeKey) return;
                readToolbarNode(editor, nodeKey, (currentNode) => {
                  action.onClick({ editor, node: currentNode });
                });
                handleCancel();
              },
            })),
          );
        }

        return result;
      }) || []
    );
  }, [editor, handleCancel, linkService, menuVersion, resolveToolbarNodeKey, t, toolbarNodeKey]);

  useLayoutEffect(() => {
    if (!toolbarNodeKey || items.length === 0) return;
    updateToolbarPosition();
  }, [items.length, menuVersion, toolbarNodeKey, updateToolbarPosition]);

  useEffect(() => {
    if (!toolbarNodeKey || typeof window === 'undefined') return;
    const handleViewportChange = () => updateToolbarPosition();
    window.addEventListener('resize', handleViewportChange, { passive: true });
    window.addEventListener('scroll', handleViewportChange, { capture: true, passive: true });
    return () => {
      window.removeEventListener('resize', handleViewportChange);
      window.removeEventListener('scroll', handleViewportChange, { capture: true });
    };
  }, [toolbarNodeKey, updateToolbarPosition]);

  useLexicalEditor(
    (lexicalEditor) => {
      let rootElement = lexicalEditor.getRootElement();

      const handleMouseOver = (event: MouseEvent) => {
        if (!enable || !editable || !rootElement) return;
        const reference = getLinkReferenceElement(event.target);
        if (!reference || !rootElement.contains(reference)) return;
        if (event.relatedTarget instanceof Node && reference.contains(event.relatedTarget)) return;

        const node = lexicalEditor
          .getEditorState()
          .read(() => $getNearestLinkToolbarNodeFromDOMNode(reference, lexicalEditor));
        if (!node) return;

        const nodeKey = node.getKey();
        if (visibleLinkKeyRef.current) showToolbar(nodeKey, reference);
        else scheduleShowToolbar(nodeKey, reference);
      };

      const handleMouseOut = (event: MouseEvent) => {
        const reference = getLinkReferenceElement(event.target);
        if (!reference || !rootElement?.contains(reference)) return;
        if (event.relatedTarget instanceof Node && reference.contains(event.relatedTarget)) return;
        if (event.relatedTarget instanceof Node && divRef.current?.contains(event.relatedTarget)) {
          return;
        }

        clearTimeout(showTimerRef.current);
        if (visibleLinkKeyRef.current !== selectedLinkKeyRef.current) scheduleHideToolbar();
      };

      if (typeof document !== 'undefined') {
        document.addEventListener('mouseover', handleMouseOver, true);
        document.addEventListener('mouseout', handleMouseOut, true);
      }

      return mergeRegister(
        lexicalEditor.registerRootListener((nextRootElement) => {
          rootElement = nextRootElement;
        }),
        lexicalEditor.registerUpdateListener(() => {
          if (!enable || !editable) {
            selectedLinkKeyRef.current = null;
            return;
          }

          const selectedLinkKey = lexicalEditor.getEditorState().read(() => {
            const selection = $getSelection();
            if (!$isRangeSelection(selection)) return null;

            const selectedNode = getSelectedNode(selection);
            const parent = selectedNode.getParent();
            const selectedToolbarNode = $isLinkToolbarNode(selectedNode)
              ? selectedNode
              : $isLinkToolbarNode(parent)
                ? parent
                : null;

            return selectedToolbarNode?.getKey() || null;
          });

          if (!selectedLinkKey) {
            selectedLinkKeyRef.current = null;
            scheduleHideToolbar();
            return;
          }

          if (selectedLinkKey === selectedLinkKeyRef.current) return;
          selectedLinkKeyRef.current = selectedLinkKey;
          const dom = lexicalEditor.getElementByKey(selectedLinkKey);
          if (dom) showToolbar(selectedLinkKey, dom);
        }),
        lexicalEditor.registerCommand(
          HOVER_LINK_COMMAND,
          (payload) => {
            if (!enable || !editable || !payload.event.target) return false;
            const reference = getLinkReferenceElement(payload.event.target);
            if (!reference || !$isLinkToolbarNode(payload.node)) return false;
            const nodeKey = payload.node.getKey();
            if (visibleLinkKeyRef.current) showToolbar(nodeKey, reference);
            else scheduleShowToolbar(nodeKey, reference);
            return false;
          },
          COMMAND_PRIORITY_NORMAL,
        ),
        lexicalEditor.registerCommand(
          HOVER_OUT_LINK_COMMAND,
          () => {
            clearTimeout(showTimerRef.current);
            if (visibleLinkKeyRef.current !== selectedLinkKeyRef.current) scheduleHideToolbar();
            return true;
          },
          COMMAND_PRIORITY_NORMAL,
        ),
        () => {
          if (typeof document !== 'undefined') {
            document.removeEventListener('mouseover', handleMouseOver, true);
            document.removeEventListener('mouseout', handleMouseOut, true);
          }
          clearTimeout(clearTimerRef.current);
          clearTimeout(showTimerRef.current);
        },
      );
    },
    [editable, enable, scheduleHideToolbar, scheduleShowToolbar, showToolbar],
  );

  if (items.length === 0) return <div className={styles.linkToolbar} ref={divRef} />;

  return (
    <div
      className={styles.linkToolbar}
      onMouseEnter={() => {
        toolbarHoverRef.current = true;
        clearTimeout(clearTimerRef.current);
      }}
      onMouseLeave={() => {
        toolbarHoverRef.current = false;
        scheduleHideToolbar(120);
      }}
      ref={divRef}
    >
      <Flexbox align={'center'} gap={8} horizontal>
        {items.map((item) => (
          <button
            aria-label={item.label}
            className={styles.popoverActionItem}
            key={item.key}
            onClick={(event) => {
              // Pointer devices run before click so the action survives
              // toolbar teardown. A detail of zero is the native keyboard /
              // assistive-technology click path.
              if (event.detail === 0) item.onClick();
            }}
            onMouseDown={(event) => {
              // Pointer-capable browsers have already executed the action in
              // pointerdown. Keep mousedown only as a compatibility fallback.
              if (Date.now() - lastPointerActionAtRef.current < 1000) {
                event.preventDefault();
                event.stopPropagation();
                return;
              }
              if (event.button !== 0) return;
              event.preventDefault();
              event.stopPropagation();
              item.onClick();
            }}
            onPointerDown={(event) => {
              if (!shouldRunToolbarActionFromPointer(event)) return;
              // Run before the browser moves focus back into Lexical. That
              // selection update can legitimately tear down this hover
              // toolbar before the following mousedown/click events arrive.
              lastPointerActionAtRef.current = Date.now();
              event.preventDefault();
              event.stopPropagation();
              item.onClick();
            }}
            title={item.label}
            type={'button'}
          >
            <Icon icon={item.icon} size={{ size: 18 }} />
          </button>
        ))}
      </Flexbox>
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

export function readToolbarNode<T>(
  editor: LexicalEditor,
  key: NodeKey,
  reader: (node: LinkToolbarNode) => T,
): T | null {
  return editor.getEditorState().read(() => {
    const node = $getNodeByKey(key);
    return $isLinkToolbarNode(node) ? reader(node) : null;
  });
}

export function shouldRunToolbarActionFromPointer(event: {
  button: number;
  pointerType: string;
}): boolean {
  // React can report an empty pointerType for synthetic/test events. The
  // primary-button contract is enough here and keeps mouse, touch, pen and
  // automation on the same pre-focus action path.
  return event.button <= 0;
}

function getLinkReferenceElement(target: EventTarget | null): HTMLElement | null {
  if (!(target instanceof Element)) return null;
  return target.closest<HTMLElement>(
    'a, [data-link-card="true"], [data-link-iframe="true"], [data-schema-link="true"]',
  );
}

LinkToolbar.displayName = 'LinkToolbar';

export default LinkToolbar;
