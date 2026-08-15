import { mergeRegister } from '@lexical/utils';
import type { IconProps } from '@lobehub/ui';
import { Flexbox, Icon } from '@lobehub/ui';
import type { LexicalEditor, NodeKey } from 'lexical';
import { $getSelection, $isRangeSelection, COMMAND_PRIORITY_NORMAL } from 'lexical';
import {
  BaselineIcon,
  CopyIcon,
  EditIcon,
  ExternalLinkIcon,
  LinkIcon,
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
  replaceNodeByKeyWithCardNode,
  replaceNodeByKeyWithIframeNode,
} from '../../conversion';
import { $isLinkNode, HOVER_LINK_COMMAND, HOVER_OUT_LINK_COMMAND } from '../../node/LinkNode';
import type {
  LinkService,
  LinkToolbarItem,
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
  const [toolbarNode, setToolbarNode] = useState<LinkToolbarNode | null>(null);
  const [menuVersion, setMenuVersion] = useState(0);
  const selectedLinkKeyRef = useRef<NodeKey | null>(null);
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
    setToolbarNode(null);
  }, []);

  const updateToolbarPosition = useCallback(() => {
    void updatePosition({
      floating: divRef.current,
      offset: 4,
      placement: 'top-start',
      reference: linkDomRef.current,
    });
  }, []);

  const showToolbar = useCallback((nextNode: LinkToolbarNode, reference: HTMLElement) => {
    clearTimeout(clearTimerRef.current);
    linkDomRef.current?.classList.remove('hover');
    linkDomRef.current = reference;
    linkDomRef.current.classList.add('hover');
    visibleLinkKeyRef.current = nextNode.getKey();
    setToolbarNode(nextNode);
  }, []);

  const scheduleShowToolbar = useCallback(
    (nextNode: LinkToolbarNode, reference: HTMLElement) => {
      clearTimeout(clearTimerRef.current);
      clearTimeout(showTimerRef.current);
      showTimerRef.current = setTimeout(() => {
        showToolbar(nextNode, reference);
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

  const context = useMemo<LinkToolbarRenderContext | null>(() => {
    if (!toolbarNode || !$isLinkNode(toolbarNode)) return null;
    return {
      close: handleCancel,
      editor,
      linkDom: linkDomRef.current,
      linkNode: toolbarNode,
    };
  }, [editor, handleCancel, toolbarNode]);

  const resolveLabel = useCallback(
    (label: LinkToolbarItem['label']) => {
      if (typeof label === 'function') return context ? label(context) : '';
      return t(label as keyof ILocaleKeys);
    },
    [context, t],
  );

  const items = useMemo<ToolbarViewItem[]>(() => {
    if (!toolbarNode) return [];

    const result: ToolbarViewItem[] = [];
    const labels = linkService?.getLabels();
    const capabilities = editor
      .getEditorState()
      .read(() => getLinkToolbarCapabilities(toolbarNode, editor, linkService));

    if (context && linkService) {
      result.push(
        ...linkService.getToolbarItems(context).map((item) => ({
          icon: toolbarIconMap[item.icon],
          key: item.key,
          label: resolveLabel(item.label),
          onClick: () => {
            void item.onClick(context);
          },
        })),
      );
    } else {
      result.push({
        icon: ExternalLinkIcon,
        key: 'open',
        label: t('link.open'),
        onClick: () => {
          const url = editor.getEditorState().read(() => getNodeUrl(toolbarNode));
          window.open(url, '_blank');
        },
      });
    }

    if (capabilities.canConvertToCard) {
      result.push({
        icon: BaselineIcon,
        key: 'convertToCard',
        label: labels?.convertToCard || 'Convert to card',
        onClick: () => {
          if (!linkService) return;
          replaceNodeByKeyWithCardNode(editor, toolbarNode.getKey(), linkService);
          handleCancel();
        },
      });
    }

    if (capabilities.canConvertToIframe) {
      result.push({
        icon: ExternalLinkIcon,
        key: 'convertToIframe',
        label: labels?.convertToIframe || 'Convert to iframe',
        onClick: () => {
          if (!linkService) return;
          replaceNodeByKeyWithIframeNode(editor, toolbarNode.getKey(), linkService);
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
          convertLinkNodeByKeyToSchema(editor, toolbarNode.getKey(), linkService);
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
          convertLinkToolbarNodeByKeyToLink(editor, toolbarNode.getKey());
          handleCancel();
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
            action.onClick({ editor, node: toolbarNode });
            handleCancel();
          },
        })),
      );
    }

    return result;
  }, [context, editor, handleCancel, linkService, menuVersion, resolveLabel, t, toolbarNode]);

  useLayoutEffect(() => {
    if (!toolbarNode || items.length === 0) return;
    updateToolbarPosition();
  }, [items.length, menuVersion, toolbarNode, updateToolbarPosition]);

  useEffect(() => {
    if (!toolbarNode || typeof window === 'undefined') return;
    const handleViewportChange = () => updateToolbarPosition();
    window.addEventListener('resize', handleViewportChange, { passive: true });
    window.addEventListener('scroll', handleViewportChange, { capture: true, passive: true });
    return () => {
      window.removeEventListener('resize', handleViewportChange);
      window.removeEventListener('scroll', handleViewportChange, { capture: true });
    };
  }, [toolbarNode, updateToolbarPosition]);

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

        if (visibleLinkKeyRef.current) showToolbar(node, reference);
        else scheduleShowToolbar(node, reference);
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

          const selection = lexicalEditor.getEditorState().read(() => $getSelection());
          if (!$isRangeSelection(selection)) {
            selectedLinkKeyRef.current = null;
            scheduleHideToolbar();
            return;
          }

          lexicalEditor.getEditorState().read(() => {
            const selectedNode = getSelectedNode(selection);
            const parent = selectedNode.getParent();
            const selectedToolbarNode = $isLinkToolbarNode(selectedNode)
              ? selectedNode
              : $isLinkToolbarNode(parent)
                ? parent
                : null;

            if (!selectedToolbarNode) {
              selectedLinkKeyRef.current = null;
              scheduleHideToolbar();
              return;
            }

            const selectedLinkKey = selectedToolbarNode.getKey();
            if (selectedLinkKey === selectedLinkKeyRef.current) return;
            selectedLinkKeyRef.current = selectedLinkKey;
            const dom = lexicalEditor.getElementByKey(selectedLinkKey);
            if (dom) showToolbar(selectedToolbarNode, dom);
          });
        }),
        lexicalEditor.registerCommand(
          HOVER_LINK_COMMAND,
          (payload) => {
            if (!enable || !editable || !payload.event.target) return false;
            const reference = getLinkReferenceElement(payload.event.target);
            if (!reference || !$isLinkToolbarNode(payload.node)) return false;
            if (visibleLinkKeyRef.current) showToolbar(payload.node, reference);
            else scheduleShowToolbar(payload.node, reference);
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
      <Flexbox
        align={'center'}
        gap={8}
        horizontal
        onMouseDown={(event) => {
          event.preventDefault();
        }}
      >
        {items.map((item) => (
          <Flexbox
            align={'center'}
            aria-label={item.label}
            className={styles.popoverActionItem}
            horizontal
            justify={'center'}
            key={item.key}
            onClick={item.onClick}
            role={'button'}
            title={item.label}
          >
            <Icon icon={item.icon} size={{ size: 18 }} />
          </Flexbox>
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

function getLinkReferenceElement(target: EventTarget | null): HTMLElement | null {
  if (!(target instanceof Element)) return null;
  return target.closest<HTMLElement>(
    'a, [data-link-card="true"], [data-link-iframe="true"], [data-schema-link="true"]',
  );
}

LinkToolbar.displayName = 'LinkToolbar';

export default LinkToolbar;
