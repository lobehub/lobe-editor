import { mergeRegister } from '@lexical/utils';
import { Flexbox, Icon } from '@lobehub/ui';
import type { IconProps } from '@lobehub/ui';
import { $getSelection, $isRangeSelection, COMMAND_PRIORITY_NORMAL, LexicalEditor } from 'lexical';
import type { NodeKey } from 'lexical';
import { CopyIcon, EditIcon, ExternalLinkIcon, UnlinkIcon } from 'lucide-react';
import { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';

import { useLexicalEditor } from '@/editor-kernel/react';
import { useEditable } from '@/editor-kernel/react/useEditable';
import { useTranslation } from '@/editor-kernel/react/useTranslation';
import { getSelectedNode } from '@/plugins/link/utils';
import type { ILocaleKeys } from '@/types';
import { cleanPosition, updatePosition } from '@/utils/updatePosition';

import {
  $isLinkNode,
  HOVER_LINK_COMMAND,
  HOVER_OUT_LINK_COMMAND,
  LinkNode,
} from '../../node/LinkNode';
import type {
  ILinkService,
  LinkToolbarItem,
  LinkToolbarItemIcon,
  LinkToolbarRenderContext,
} from '../../service/i-link-service';
import { styles } from '../style';

interface LinkToolbarProps {
  editor: LexicalEditor;
  enable: boolean;
  service: ILinkService | null;
}

const HOVER_OPEN_DELAY = 180;
const HOVER_CLOSE_DELAY = 500;

const toolbarIconMap: Record<LinkToolbarItemIcon, IconProps['icon']> = {
  copy: CopyIcon,
  edit: EditIcon,
  open: ExternalLinkIcon,
  unlink: UnlinkIcon,
};

const LinkToolbar = memo<LinkToolbarProps>(({ editor, enable, service }) => {
  const divRef = useRef<HTMLDivElement>(null);
  const linkDomRef = useRef<HTMLElement | null>(null);
  const [linkNode, setLinkNode] = useState<LinkNode | null>(null);
  const [menuVersion, setMenuVersion] = useState(0);
  const selectedLinkKeyRef = useRef<NodeKey | null>(null);
  const toolbarHoverRef = useRef(false);
  const visibleLinkKeyRef = useRef<NodeKey | null>(null);
  const t = useTranslation();
  const clearTimerRef = useRef<ReturnType<typeof setTimeout> | number>(-1);
  const showTimerRef = useRef<ReturnType<typeof setTimeout> | number>(-1);
  const { editable } = useEditable();

  const handleCancel = useCallback(() => {
    clearTimeout(clearTimerRef.current);
    clearTimeout(showTimerRef.current);
    linkDomRef.current = null;
    toolbarHoverRef.current = false;
    visibleLinkKeyRef.current = null;
    cleanPosition(divRef.current);
  }, []);

  const updateToolbarPosition = useCallback(() => {
    updatePosition({
      floating: divRef.current,
      offset: 4,
      placement: 'top-start',
      reference: linkDomRef.current,
    });
  }, []);

  const showToolbar = useCallback((nextLinkNode: LinkNode, reference: HTMLElement) => {
    clearTimeout(clearTimerRef.current);
    linkDomRef.current = reference;
    visibleLinkKeyRef.current = nextLinkNode.getKey();
    setLinkNode(nextLinkNode);
  }, []);

  const scheduleShowToolbar = useCallback(
    (nextLinkNode: LinkNode, reference: HTMLElement) => {
      clearTimeout(clearTimerRef.current);
      clearTimeout(showTimerRef.current);
      showTimerRef.current = setTimeout(() => {
        showToolbar(nextLinkNode, reference);
      }, HOVER_OPEN_DELAY);
    },
    [showToolbar],
  );

  const scheduleHideToolbar = useCallback(
    (delay = HOVER_CLOSE_DELAY) => {
      clearTimeout(clearTimerRef.current);
      clearTimerRef.current = setTimeout(() => {
        if (toolbarHoverRef.current) return;
        handleCancel();
      }, delay);
    },
    [handleCancel],
  );

  useEffect(() => {
    if (!service) return;
    return service.subscribe(() => {
      setMenuVersion((version) => version + 1);
    });
  }, [service]);

  const context = useMemo<LinkToolbarRenderContext | null>(() => {
    if (!linkNode) return null;
    return {
      close: handleCancel,
      editor,
      linkDom: linkDomRef.current,
      linkNode,
    };
  }, [editor, handleCancel, linkNode]);

  const actionItems = useMemo(() => {
    if (!context || !service) return [];
    return service.getToolbarItems(context);
  }, [context, menuVersion, service]);

  useLayoutEffect(() => {
    if (!linkNode || actionItems.length === 0) return;
    updateToolbarPosition();
  }, [actionItems.length, linkNode, menuVersion, updateToolbarPosition]);

  const resolveLabel = useCallback(
    (label: LinkToolbarItem['label']) => {
      if (typeof label === 'function') {
        return context ? label(context) : '';
      }
      return t(label as keyof ILocaleKeys);
    },
    [context, t],
  );

  const handleItemClick = useCallback(
    (itemContext: LinkToolbarRenderContext, onClick: LinkToolbarItem['onClick']) => {
      void onClick(itemContext);
    },
    [],
  );

  useEffect(() => {
    if (linkNode && actionItems.length === 0) {
      handleCancel();
    }
  }, [actionItems.length, handleCancel, linkNode]);

  useLexicalEditor(
    (editor) => {
      if (!editable) return;
      return mergeRegister(
        editor.registerUpdateListener(() => {
          if (!enable) {
            selectedLinkKeyRef.current = null;
            return;
          }
          const selection = editor.getEditorState().read(() => $getSelection());
          if (!selection) {
            selectedLinkKeyRef.current = null;
            scheduleHideToolbar();
            return;
          }
          if ($isRangeSelection(selection)) {
            editor.getEditorState().read(() => {
              const node = getSelectedNode(selection);
              const parent = node.getParent();
              const isLink = $isLinkNode(parent) || $isLinkNode(node);
              if (isLink) {
                const selectedLinkNode = $isLinkNode(parent)
                  ? (parent as LinkNode)
                  : (node as LinkNode);
                const selectedLinkKey = selectedLinkNode.getKey();
                if (selectedLinkKey === selectedLinkKeyRef.current) return;
                selectedLinkKeyRef.current = selectedLinkKey;

                const dom = editor.getElementByKey(selectedLinkKey);
                if (dom && divRef.current) showToolbar(selectedLinkNode, dom as HTMLElement);
              } else {
                selectedLinkKeyRef.current = null;
                scheduleHideToolbar();
              }
            });
          } else {
            selectedLinkKeyRef.current = null;
            scheduleHideToolbar();
          }
        }),
        editor.registerCommand(
          HOVER_LINK_COMMAND,
          (payload) => {
            if (!enable || !service) return false;
            if (!payload.event.target || divRef.current === null) return false;
            const reference = payload.event.target as HTMLElement;
            if (visibleLinkKeyRef.current) {
              showToolbar(payload.linkNode, reference);
            } else {
              scheduleShowToolbar(payload.linkNode, reference);
            }
            return false;
          },
          COMMAND_PRIORITY_NORMAL,
        ),
        editor.registerCommand(
          HOVER_OUT_LINK_COMMAND,
          () => {
            clearTimeout(showTimerRef.current);
            if (visibleLinkKeyRef.current !== selectedLinkKeyRef.current) {
              scheduleHideToolbar();
            }
            return true;
          },
          COMMAND_PRIORITY_NORMAL,
        ),
      );
    },
    [enable, editable, scheduleHideToolbar, scheduleShowToolbar, service, showToolbar],
  );

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
        onMouseDown={(e) => {
          e.preventDefault();
        }}
      >
        {context &&
          actionItems.map((item) => {
            const label = resolveLabel(item.label);
            return (
              <Flexbox
                align={'center'}
                aria-label={label}
                className={styles.popoverActionItem}
                horizontal
                justify={'center'}
                key={item.key}
                onClick={() => {
                  handleItemClick(context, item.onClick);
                }}
                role={'button'}
                title={label}
              >
                <Icon icon={toolbarIconMap[item.icon]} size={{ size: 18 }} />
              </Flexbox>
            );
          })}
      </Flexbox>
    </div>
  );
});

LinkToolbar.displayName = 'LinkToolbar';

export default LinkToolbar;
