'use client';

import { Icon } from '@lobehub/ui';
import { Button, Dropdown, theme } from 'antd';
import { cx } from 'antd-style';
import { GripVerticalIcon, PlusIcon } from 'lucide-react';
import {
  type CSSProperties,
  type FC,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { createPortal } from 'react-dom';

import { useLexicalEditor } from '@/editor-kernel/react';
import { useLexicalComposerContext } from '@/editor-kernel/react/react-context';
import { ILocaleKeys } from '@/types';
import { createDebugLogger } from '@/utils/debug';

import { BlockPlugin, type BlockPluginOptions } from '../plugin';
import { BlockMenuService, type IBlockMenuRenderContext, IBlockMenuService } from '../service';
import { HOVER_HIDE_DELAY } from './core/constants';
import {
  type HoveredBlockState,
  type RuntimeContextRef,
  createRuntimeContext,
} from './core/runtime-context';
import { type BlockDragTarget } from './core/types';
import { startBlockDragSession } from './drag/drag-session';
import { collectDragBlocks } from './drag/drag-utils';
import { styles } from './style';

export interface ReactBlockPluginProps extends Omit<BlockPluginOptions, 'className'> {
  className?: string;
  locale?: Partial<Record<keyof ILocaleKeys, string>>;
  onDragTargetChange?: (target: BlockDragTarget | null) => void;
  onDragTargetResolve?: (target: BlockDragTarget | null) => void;
  onHoverBlockChange?: (context: IBlockMenuRenderContext | null) => void;
  rootClassName?: string;
}

const logger = createDebugLogger('plugin', 'block-react');
const OPERATION_MENU_OVERLAY_CLASS = 'lobe-block-operation-dropdown';

const ReactBlockPlugin: FC<ReactBlockPluginProps> = (props) => {
  const { token } = theme.useToken();
  const [editor] = useLexicalComposerContext();
  const {
    rootClassName,
    className,
    attributeName,
    locale,
    onHoverBlockChange,
    onDragTargetChange,
    onDragTargetResolve,
  } = props;
  const mergedRootClassName = cx(styles.root, rootClassName?.trim() || className?.trim());
  const menuRef = useRef<HTMLDivElement>(null);
  const dragLayerRef = useRef<HTMLDivElement>(null);
  const contextRef = useRef<RuntimeContextRef>(createRuntimeContext());
  const [hoveredBlock, setHoveredBlock] = useState<HoveredBlockState>(null);
  const [menuVersion, setMenuVersion] = useState(0);
  const [menuPosition, setMenuPosition] = useState<CSSProperties>({});
  const [operationMenuOpen, setOperationMenuOpen] = useState(false);
  const [operationMenuContext, setOperationMenuContext] = useState<IBlockMenuRenderContext | null>(
    null,
  );
  const [dragIndicator, setDragIndicator] = useState<{
    left: number;
    top: number;
    width: number;
  } | null>(null);
  const [dragLayerContainer, setDragLayerContainer] = useState<HTMLElement | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [blockMenuService, setBlockMenuService] = useState<BlockMenuService | null>(null);

  useLayoutEffect(() => {
    if (locale) {
      editor.registerLocale(locale);
    }

    editor.registerPlugin(BlockPlugin, {
      attributeName,
      className: mergedRootClassName,
    });
  }, [attributeName, editor, locale, mergedRootClassName]);

  useLexicalEditor(() => {
    const service = editor.requireService(IBlockMenuService) as BlockMenuService | null;
    if (!service) {
      logger.warn('BlockMenuService not found');
      return;
    }

    setBlockMenuService(service);

    return () => {
      setBlockMenuService((current) => (current === service ? null : current));
    };
  }, []);

  useEffect(() => {
    contextRef.current.hoveredBlock = hoveredBlock;
  }, [hoveredBlock]);

  useEffect(() => {
    if (!blockMenuService) return;

    return blockMenuService.subscribe(() => {
      setMenuVersion((v) => v + 1);
    });
  }, [blockMenuService]);

  useEffect(() => {
    return () => {
      contextRef.current.dragCleanup?.();
      contextRef.current.dragCleanup = null;
      setIsDragging(false);
    };
  }, []);

  useEffect(() => {
    let raf: number | null = null;

    const syncDragLayerContainer = () => {
      const container = editor.getRootElement()?.parentElement ?? null;
      setDragLayerContainer((current) => (current === container ? current : container));

      if (!container) {
        raf = window.requestAnimationFrame(syncDragLayerContainer);
      }
    };

    syncDragLayerContainer();

    return () => {
      if (raf !== null) {
        window.cancelAnimationFrame(raf);
      }
    };
  }, [editor]);

  useEffect(() => {
    let hoverRaf: number | null = null;
    let blockRectsCache = collectDragBlocks(editor.getRootElement());
    let blockRectsDirty = true;
    let latestPointer: { clientX: number; clientY: number; target: EventTarget | null } | null =
      null;

    const markBlockRectsDirty = () => {
      blockRectsDirty = true;
    };

    const getBlockRects = (root: HTMLElement) => {
      if (blockRectsDirty) {
        blockRectsCache = collectDragBlocks(root);
        blockRectsDirty = false;
      }

      return blockRectsCache;
    };

    const resolveBlockByY = (
      rects: ReturnType<typeof collectDragBlocks>,
      y: number,
    ): (typeof rects)[number] | null => {
      if (rects.length === 0) return null;

      let left = 0;
      let right = rects.length - 1;

      while (left <= right) {
        const mid = (left + right) >> 1;
        const entry = rects[mid];

        if (y < entry.rect.top) {
          right = mid - 1;
          continue;
        }

        if (y > entry.rect.bottom) {
          left = mid + 1;
          continue;
        }

        return entry;
      }

      const nextIndex = Math.min(Math.max(left, 0), rects.length - 1);
      const prevIndex = Math.min(Math.max(right, 0), rects.length - 1);
      const next = rects[nextIndex];
      const prev = rects[prevIndex];

      if (!next) return prev || null;
      if (!prev) return next || null;

      const nextDistance = Math.min(Math.abs(y - next.rect.top), Math.abs(y - next.rect.bottom));
      const prevDistance = Math.min(Math.abs(y - prev.rect.top), Math.abs(y - prev.rect.bottom));

      return nextDistance < prevDistance ? next : prev;
    };

    const isInRootLeftPaddingArea = (root: HTMLElement, clientX: number, clientY: number) => {
      const rootRect = root.getBoundingClientRect();
      const inRootBounds =
        clientX >= rootRect.left &&
        clientX <= rootRect.right &&
        clientY >= rootRect.top &&
        clientY <= rootRect.bottom;

      if (!inRootBounds) {
        return false;
      }

      const paddingLeft = Number.parseFloat(window.getComputedStyle(root).paddingLeft || '0');
      if (paddingLeft <= 0) {
        return false;
      }

      return clientX <= rootRect.left + paddingLeft;
    };

    const getHoveredBlock = (target: EventTarget | null, clientX: number, clientY: number) => {
      const root = editor.getRootElement();

      if (!root || !(target instanceof Node)) {
        return null;
      }

      const targetElement = target instanceof Element ? target : target.parentElement;
      if (!targetElement) {
        return null;
      }

      if (menuRef.current?.contains(targetElement)) {
        return contextRef.current.hoveredBlock;
      }

      if (targetElement.closest(`.${OPERATION_MENU_OVERLAY_CLASS}`)) {
        return contextRef.current.hoveredBlock;
      }

      const blockElement = targetElement.closest('[data-block-id]');

      if (blockElement instanceof HTMLElement && root.contains(blockElement)) {
        const blockId = blockElement.dataset.blockId;
        if (!blockId) {
          return null;
        }

        return { blockElement, blockId };
      }

      if (!root.contains(targetElement)) {
        return null;
      }

      if (!isInRootLeftPaddingArea(root, clientX, clientY)) {
        return null;
      }

      const rects = getBlockRects(root);
      if (rects.length === 0) {
        return null;
      }

      const entry = resolveBlockByY(rects, clientY);

      if (!entry) return null;

      return {
        blockElement: entry.block,
        blockId: entry.blockId,
      };
    };

    const processHover = () => {
      if (!latestPointer) {
        return;
      }

      if (contextRef.current.draggingSource) {
        return;
      }

      const { clientX, clientY, target } = latestPointer;
      const next = getHoveredBlock(target, clientX, clientY);

      if (next) {
        if (contextRef.current.hideTimer !== null) {
          window.clearTimeout(contextRef.current.hideTimer);
          contextRef.current.hideTimer = null;
        }

        setHoveredBlock((current) => {
          if (!current) return next;
          if (next.blockId === current.blockId && next.blockElement === current.blockElement) {
            return current;
          }
          return next;
        });

        return;
      }

      if (contextRef.current.hideTimer !== null) {
        return;
      }

      contextRef.current.hideTimer = window.setTimeout(() => {
        contextRef.current.hideTimer = null;
        setHoveredBlock((current) => (current ? null : current));
      }, HOVER_HIDE_DELAY);
    };

    const scheduleHoverProcess = () => {
      if (hoverRaf !== null) {
        return;
      }

      hoverRaf = window.requestAnimationFrame(() => {
        hoverRaf = null;
        processHover();
      });
    };

    const handleMouseMove = (event: MouseEvent) => {
      const root = editor.getRootElement();
      const target = event.target;

      if (!root || !(target instanceof Node)) {
        if (!contextRef.current.hoveredBlock) return;
      } else {
        const targetElement = target instanceof Element ? target : target.parentElement;

        if (!targetElement) {
          if (!contextRef.current.hoveredBlock) return;
        } else {
          const overMenu =
            menuRef.current?.contains(targetElement) ||
            Boolean(targetElement.closest(`.${OPERATION_MENU_OVERLAY_CLASS}`));
          const overBlock =
            targetElement.closest('[data-block-id]') instanceof HTMLElement &&
            root.contains(targetElement);
          const inPaddingArea = root.contains(targetElement)
            ? isInRootLeftPaddingArea(root, event.clientX, event.clientY)
            : false;

          if (!overMenu && !overBlock && !inPaddingArea && !contextRef.current.hoveredBlock) {
            return;
          }
        }
      }

      latestPointer = {
        clientX: event.clientX,
        clientY: event.clientY,
        target,
      };

      scheduleHoverProcess();
    };

    const handleViewportChange = () => {
      markBlockRectsDirty();
      scheduleHoverProcess();
    };

    const rootResizeObserver =
      typeof ResizeObserver !== 'undefined'
        ? new ResizeObserver(() => {
            markBlockRectsDirty();
          })
        : null;

    const root = editor.getRootElement();
    const unregisterUpdate =
      editor.getLexicalEditor()?.registerUpdateListener(() => {
        markBlockRectsDirty();
        scheduleHoverProcess();
      }) || (() => {});

    if (root) {
      rootResizeObserver?.observe(root);
    }

    document.addEventListener('mousemove', handleMouseMove, true);
    window.addEventListener('resize', handleViewportChange);
    document.addEventListener('scroll', handleViewportChange, true);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove, true);
      window.removeEventListener('resize', handleViewportChange);
      document.removeEventListener('scroll', handleViewportChange, true);

      rootResizeObserver?.disconnect();
      unregisterUpdate();

      if (hoverRaf !== null) {
        window.cancelAnimationFrame(hoverRaf);
        hoverRaf = null;
      }

      if (contextRef.current.hideTimer !== null) {
        window.clearTimeout(contextRef.current.hideTimer);
        contextRef.current.hideTimer = null;
      }
    };
  }, [editor, isDragging]);

  useEffect(() => {
    if (!hoveredBlock) {
      if (operationMenuOpen) {
        return;
      }

      setMenuPosition({});
      return;
    }

    const updateMenuPosition = () => {
      const rect = hoveredBlock.blockElement.getBoundingClientRect();
      const menuWidth = menuRef.current?.offsetWidth || 32;
      const gap = 8;
      const listItemOffset = hoveredBlock.blockElement.tagName === 'LI' ? 16 : 0;

      setMenuPosition({
        left: Math.max(gap, rect.left - menuWidth - gap - listItemOffset),
        top: rect.top,
      });
    };

    updateMenuPosition();

    window.addEventListener('resize', updateMenuPosition);
    document.addEventListener('scroll', updateMenuPosition, true);

    return () => {
      window.removeEventListener('resize', updateMenuPosition);
      document.removeEventListener('scroll', updateMenuPosition, true);
    };
  }, [hoveredBlock]);

  const menuContext = useMemo<IBlockMenuRenderContext | null>(() => {
    if (!hoveredBlock) return null;

    return {
      blockElement: hoveredBlock.blockElement,
      blockId: hoveredBlock.blockId,
      editor,
    };
  }, [editor, hoveredBlock]);

  const operationMenus = useMemo(() => {
    if (!operationMenuContext || !blockMenuService) return [];

    return blockMenuService.getMenus(operationMenuContext);
  }, [blockMenuService, operationMenuContext, menuVersion]);

  const actionButtons = useMemo(() => {
    if (!menuContext || !blockMenuService) return [];

    return blockMenuService.getActionButtons(menuContext);
  }, [blockMenuService, menuContext, menuVersion]);

  useEffect(() => {
    onHoverBlockChange?.(menuContext);
  }, [menuContext, onHoverBlockChange]);

  useEffect(() => {
    if (!operationMenuOpen || !menuContext || !contextRef.current.operationMenuAnchorBlockId) {
      return;
    }

    if (contextRef.current.operationMenuAnchorBlockId !== menuContext.blockId) {
      setOperationMenuOpen(false);
      setOperationMenuContext(null);
    }
  }, [menuContext, operationMenuOpen]);

  useEffect(() => {
    if (!operationMenuOpen) {
      contextRef.current.operationMenuAnchorBlockId = null;
      setOperationMenuContext(null);
    }
  }, [operationMenuOpen]);

  useEffect(() => {
    if (!operationMenuOpen) {
      return;
    }

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Element)) {
        return;
      }

      if (menuRef.current?.contains(target)) {
        return;
      }

      if (target.closest(`.${OPERATION_MENU_OVERLAY_CLASS}`)) {
        return;
      }

      contextRef.current.operationMenuAnchorBlockId = null;
      setOperationMenuOpen(false);
      setOperationMenuContext(null);
    };

    document.addEventListener('pointerdown', handlePointerDown, true);

    return () => {
      document.removeEventListener('pointerdown', handlePointerDown, true);
    };
  }, [operationMenuOpen]);

  useEffect(() => {
    onDragTargetChange?.(contextRef.current.dragTarget);
  }, [dragIndicator, onDragTargetChange]);

  const preventEditorSelectionLost = (event: ReactMouseEvent<HTMLDivElement>) => {
    const target = event.target as HTMLElement | null;
    const dragHandle = target?.closest('[data-block-drag-handle="true"]');

    if (dragHandle) {
      return;
    }

    event.preventDefault();
  };

  const clearDragPreview = () => {
    contextRef.current.dragTarget = null;
    setDragIndicator(null);
  };

  const toggleOperationMenu = (context: IBlockMenuRenderContext | null) => {
    if (!context) {
      setOperationMenuOpen(false);
      setOperationMenuContext(null);
      return;
    }

    setOperationMenuOpen((open) => {
      const shouldOpen = !(
        open && contextRef.current.operationMenuAnchorBlockId === context.blockId
      );
      contextRef.current.operationMenuAnchorBlockId = shouldOpen ? context.blockId : null;
      setOperationMenuContext(shouldOpen ? context : null);
      return shouldOpen;
    });
  };

  const handleDragHandlePointerDown = (event: ReactPointerEvent<HTMLElement>) => {
    if (!menuContext) return;

    event.stopPropagation();

    startBlockDragSession({
      clearDragPreview,
      clientX: event.clientX,
      clientY: event.clientY,
      contextRef,
      dragGhostContainer: dragLayerRef.current,
      editor,
      menuContext,
      onDragTargetResolve,
      onDraggingChange: setIsDragging,
      setDragIndicator,
      setOperationMenuContext,
      setOperationMenuOpen,
      toggleOperationMenu,
    });
  };

  const handleDragHandleClick = () => {
    if (contextRef.current.ignoreNextHandleClick) {
      contextRef.current.ignoreNextHandleClick = false;
      return;
    }

    toggleOperationMenu(menuContext);
  };

  const dropdownItems = useMemo(
    () =>
      operationMenus.map((item) => ({
        key: item.key,
        label: typeof item.label === 'function' ? item.label(operationMenuContext!) : item.label,
        onClick: () => {
          item.onClick(operationMenuContext!);
          setOperationMenuOpen(false);
          setOperationMenuContext(null);
        },
      })),
    [operationMenus, operationMenuContext],
  );

  const shouldRenderPortal = menuContext || dragIndicator;

  const menuNode =
    menuContext && !isDragging ? (
      <div className={styles.menu} ref={menuRef} style={menuPosition}>
        <div className={styles.menuInner} onMouseDown={preventEditorSelectionLost}>
          {actionButtons.map((item) => {
            const title = typeof item.title === 'function' ? item.title(menuContext) : item.title;
            const icon = item.icon === 'plus' ? <Icon icon={PlusIcon} size={14} /> : undefined;

            return (
              <Button
                aria-label={title}
                icon={icon}
                key={item.key}
                onClick={() => item.onClick(menuContext)}
                size={'small'}
                title={title}
                type={'text'}
              />
            );
          })}
          <Dropdown
            align={{
              points: ['tr', 'tl'],
            }}
            classNames={{
              root: OPERATION_MENU_OVERLAY_CLASS,
            }}
            menu={{ items: dropdownItems }}
            onOpenChange={(open) => {
              if (!open) {
                setOperationMenuOpen(false);
                setOperationMenuContext(null);
                contextRef.current.operationMenuAnchorBlockId = null;
              }
            }}
            open={operationMenuOpen && operationMenuContext?.blockId === menuContext.blockId}
            trigger={[]}
          >
            <Button
              aria-label={'Block actions and drag'}
              className={styles.dragHandle}
              data-block-drag-handle={'true'}
              icon={<Icon icon={GripVerticalIcon} size={14} />}
              onClick={handleDragHandleClick}
              onPointerDown={handleDragHandlePointerDown}
              size={'small'}
              title={'Block actions and drag'}
              type={'text'}
            />
          </Dropdown>
        </div>
      </div>
    ) : null;
  const dragLayerNode = (
    <div
      aria-hidden={'true'}
      className={styles.dragLayer}
      data-block-drag-layer={'true'}
      ref={dragLayerRef}
    />
  );

  return (
    <>
      {dragLayerContainer ? createPortal(dragLayerNode, dragLayerContainer) : dragLayerNode}
      {shouldRenderPortal &&
        createPortal(
          <>
            {menuNode}
            {dragIndicator && (
              <div
                className={styles.dragIndicator}
                style={{
                  backgroundColor: token.colorPrimary,
                  left: dragIndicator.left,
                  top: dragIndicator.top,
                  width: dragIndicator.width,
                }}
              />
            )}
          </>,
          document.body,
        )}
    </>
  );
};

ReactBlockPlugin.displayName = 'ReactBlockPlugin';

export default ReactBlockPlugin;
