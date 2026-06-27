'use client';

import { $findTableNode, $isTableSelection } from '@lexical/table';
import { DropdownMenu, type DropdownMenuProps, Icon, useAppElement } from '@lobehub/ui';
import { Button, theme } from 'antd';
import { cx } from 'antd-style';
import { $getNodeByKey, $getSelection, $isRangeSelection } from 'lexical';
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
import { useEditable } from '@/editor-kernel/react/useEditable';
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
import {
  collectDragBlocks,
  getBlockMeasureRect,
  getTableBlockRect,
  isTableBlockElement,
} from './drag/drag-utils';
import { ANCHOR_PADDING_CSS_VAR, styles } from './style';

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
const TABLE_FOCUSED_MENU_OFFSET = 8;

type HoverResolveResult = NonNullable<HoveredBlockState> & {
  source: 'direct' | 'existing' | 'padding';
};

const getTableMenuAnchorRect = (element: HTMLElement) => {
  const rect = getTableBlockRect(element);
  if (!rect) return null;

  return {
    left: rect.left,
    top: rect.top,
  };
};

const isBlockInsideElement = (block: HTMLElement, container: HTMLElement): boolean => {
  return block !== container && container.contains(block);
};

const getElementDepth = (element: HTMLElement, stopAt: HTMLElement): number => {
  let depth = 0;
  let current: HTMLElement | null = element;

  while (current && current !== stopAt) {
    depth += 1;
    current = current.parentElement;
  }

  return depth;
};

const ReactBlockPlugin: FC<ReactBlockPluginProps> = (props) => {
  const { token } = theme.useToken();
  const [editor] = useLexicalComposerContext();
  const appElement = useAppElement();
  const {
    rootClassName,
    className,
    attributeName,
    anchorPadding,
    locale,
    onHoverBlockChange,
    onDragTargetChange,
    onDragTargetResolve,
  } = props;
  const mergedRootClassName = cx(styles.root, rootClassName?.trim() || className?.trim());
  const anchorPaddingValue = useMemo(() => {
    if (anchorPadding === undefined) return null;
    return typeof anchorPadding === 'number' ? `${anchorPadding}px` : anchorPadding;
  }, [anchorPadding]);
  const menuRef = useRef<HTMLDivElement>(null);
  const dragLayerRef = useRef<HTMLDivElement>(null);
  const contextRef = useRef<RuntimeContextRef>(createRuntimeContext());
  const [hoveredBlock, setHoveredBlock] = useState<HoveredBlockState>(null);
  const [layoutVersion, setLayoutVersion] = useState(0);
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
  const [focusedTableBlockId, setFocusedTableBlockId] = useState<string | null>(null);
  const [blockMenuService, setBlockMenuService] = useState<BlockMenuService | null>(null);
  const { editable } = useEditable();
  const blockMenuSuppressed = (blockMenuService?.isMenuSuppressed() ?? false) || editable === false;

  useLayoutEffect(() => {
    if (locale) {
      editor.registerLocale(locale);
    }

    editor.registerPlugin(BlockPlugin, {
      anchorPadding,
      attributeName,
      className: mergedRootClassName,
    });
  }, [anchorPadding, attributeName, editor, locale, mergedRootClassName]);

  useLexicalEditor(
    (lexicalEditor) =>
      lexicalEditor.registerRootListener((rootElement, prevRootElement) => {
        if (prevRootElement) {
          prevRootElement.style.removeProperty(ANCHOR_PADDING_CSS_VAR);
        }
        if (!rootElement) return;
        if (anchorPaddingValue === null) {
          rootElement.style.removeProperty(ANCHOR_PADDING_CSS_VAR);
        } else {
          rootElement.style.setProperty(ANCHOR_PADDING_CSS_VAR, anchorPaddingValue);
        }
      }),
    [anchorPaddingValue],
  );

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
    if (!blockMenuSuppressed) return;

    setHoveredBlock(null);
    setOperationMenuOpen(false);
    setOperationMenuContext(null);
    contextRef.current.operationMenuAnchorBlockId = null;
  }, [blockMenuSuppressed]);

  useLexicalEditor(
    (lexicalEditor) => {
      return lexicalEditor.registerUpdateListener(({ editorState }) => {
        editorState.read(() => {
          const selection = $getSelection();
          if ($isTableSelection(selection)) {
            setFocusedTableBlockId(selection.tableKey);
            return;
          }

          if ($isRangeSelection(selection)) {
            const anchorNode = $getNodeByKey(selection.anchor.key);
            const tableNode = anchorNode ? $findTableNode(anchorNode) : null;
            setFocusedTableBlockId(tableNode?.getKey() ?? null);
            return;
          }

          setFocusedTableBlockId(null);
        });
      });
    },
    [editor],
  );

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

    const resolveNestedBlockByY = (
      rects: ReturnType<typeof collectDragBlocks>,
      container: HTMLElement,
      y: number,
    ): (typeof rects)[number] | null => {
      const candidates = rects.filter(
        (entry) =>
          isBlockInsideElement(entry.block, container) &&
          y >= entry.rect.top &&
          y <= entry.rect.bottom,
      );

      if (candidates.length === 0) {
        return null;
      }

      return candidates.sort((a, b) => {
        const depthA = getElementDepth(a.block, container);
        const depthB = getElementDepth(b.block, container);

        if (depthA !== depthB) {
          return depthB - depthA;
        }

        return a.rect.height - b.rect.height;
      })[0];
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

    const resolveCurrentBlockElement = (root: HTMLElement, blockId: string): HTMLElement | null => {
      const currentBlock = Array.from(root.querySelectorAll<HTMLElement>('[data-block-id]')).find(
        (element) => element.dataset.blockId === blockId,
      );

      return currentBlock && root.contains(currentBlock) ? currentBlock : null;
    };

    const getHoveredBlock = (
      target: EventTarget | null,
      clientX: number,
      clientY: number,
    ): HoverResolveResult | null => {
      const root = editor.getRootElement();

      if (!root || !(target instanceof Node)) {
        return null;
      }

      const targetElement = target instanceof Element ? target : target.parentElement;
      if (!targetElement) {
        return null;
      }

      if (menuRef.current?.contains(targetElement)) {
        return contextRef.current.hoveredBlock
          ? { ...contextRef.current.hoveredBlock, source: 'existing' }
          : null;
      }

      if (targetElement.closest(`.${OPERATION_MENU_OVERLAY_CLASS}`)) {
        return contextRef.current.hoveredBlock
          ? { ...contextRef.current.hoveredBlock, source: 'existing' }
          : null;
      }

      const blockElement = targetElement.closest('[data-block-id]');

      if (blockElement instanceof HTMLElement && root.contains(blockElement)) {
        if (blockElement.dataset.collapsible === 'true') {
          const nestedEntry = resolveNestedBlockByY(getBlockRects(root), blockElement, clientY);

          if (nestedEntry) {
            const nestedBlockElement = resolveCurrentBlockElement(root, nestedEntry.blockId);

            if (nestedBlockElement) {
              return {
                blockElement: nestedBlockElement,
                blockId: nestedEntry.blockId,
                source: 'direct',
              };
            }
          }
        }

        const blockId = blockElement.dataset.blockId;
        if (!blockId) {
          return null;
        }

        return { blockElement, blockId, source: 'direct' };
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

      if (!entry) {
        return null;
      }

      const currentBlockElement = resolveCurrentBlockElement(root, entry.blockId);
      if (!currentBlockElement) {
        markBlockRectsDirty();
        return null;
      }

      return {
        blockElement: currentBlockElement,
        blockId: entry.blockId,
        source: 'padding',
      };
    };

    const processHover = () => {
      if (blockMenuSuppressed) {
        return;
      }

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
            if (next.source === 'padding') {
              setLayoutVersion((version) => version + 1);
            }
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
      if (blockMenuSuppressed) {
        return;
      }

      const root = editor.getRootElement();
      const target = event.target;

      if (!root || !(target instanceof Node)) {
        if (!contextRef.current.hoveredBlock) {
          return;
        }
      } else {
        const targetElement = target instanceof Element ? target : target.parentElement;

        if (!targetElement) {
          if (!contextRef.current.hoveredBlock) {
            return;
          }
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
      if (blockMenuSuppressed) {
        return;
      }

      scheduleHoverProcess();
    };

    const clearMenuState = () => {
      if (contextRef.current.hideTimer !== null) {
        window.clearTimeout(contextRef.current.hideTimer);
        contextRef.current.hideTimer = null;
      }

      latestPointer = null;
      contextRef.current.operationMenuAnchorBlockId = null;
      setHoveredBlock(null);
      setOperationMenuOpen(false);
      setOperationMenuContext(null);
    };

    const isInsideMenu = (target: EventTarget | null) => {
      if (!(target instanceof Element)) {
        return false;
      }

      return (
        Boolean(menuRef.current?.contains(target)) ||
        Boolean(target.closest(`.${OPERATION_MENU_OVERLAY_CLASS}`))
      );
    };

    const handlePointerDown = (event: PointerEvent) => {
      const rootElement = editor.getRootElement();
      const target = event.target;

      if (!(target instanceof Node)) {
        clearMenuState();
        return;
      }

      if (rootElement?.contains(target) || isInsideMenu(target)) {
        return;
      }

      clearMenuState();
    };

    const handleFocusOut = () => {
      window.requestAnimationFrame(() => {
        const rootElement = editor.getRootElement();
        const activeElement = rootElement?.ownerDocument.activeElement;

        if (!activeElement) {
          clearMenuState();
          return;
        }

        if (rootElement?.contains(activeElement) || isInsideMenu(activeElement)) {
          return;
        }

        clearMenuState();
      });
    };

    const rootResizeObserver =
      typeof ResizeObserver !== 'undefined'
        ? new ResizeObserver(() => {
            markBlockRectsDirty();
            setLayoutVersion((version) => version + 1);
            if (blockMenuSuppressed) {
              return;
            }

            scheduleHoverProcess();
          })
        : null;

    const root = editor.getRootElement();
    const rootMutationObserver =
      root && typeof MutationObserver !== 'undefined'
        ? new MutationObserver(() => {
            markBlockRectsDirty();
            setLayoutVersion((version) => version + 1);
            if (blockMenuSuppressed) {
              return;
            }

            scheduleHoverProcess();
          })
        : null;
    const unregisterUpdate =
      editor.getLexicalEditor()?.registerUpdateListener(() => {
        markBlockRectsDirty();
        if (blockMenuSuppressed) {
          setHoveredBlock(null);
          setLayoutVersion((version) => version + 1);
          return;
        }

        setHoveredBlock((current) => {
          if (!current) return current;

          const currentRoot = editor.getRootElement();
          const currentBlockId = current.blockElement.dataset.blockId;

          if (
            !currentRoot ||
            !current.blockElement.isConnected ||
            !currentRoot.contains(current.blockElement) ||
            currentBlockId !== current.blockId
          ) {
            return null;
          }

          return current;
        });
        setLayoutVersion((version) => version + 1);
        scheduleHoverProcess();
      }) || (() => {});

    if (root) {
      rootResizeObserver?.observe(root);
      rootMutationObserver?.observe(root, {
        attributes: true,
        childList: true,
        subtree: true,
      });
    }

    document.addEventListener('mousemove', handleMouseMove, true);
    document.addEventListener('pointerdown', handlePointerDown, true);
    window.addEventListener('resize', handleViewportChange);
    document.addEventListener('scroll', handleViewportChange, true);
    root?.addEventListener('focusout', handleFocusOut);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove, true);
      document.removeEventListener('pointerdown', handlePointerDown, true);
      window.removeEventListener('resize', handleViewportChange);
      document.removeEventListener('scroll', handleViewportChange, true);
      root?.removeEventListener('focusout', handleFocusOut);

      rootResizeObserver?.disconnect();
      rootMutationObserver?.disconnect();
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
  }, [blockMenuSuppressed, editor, isDragging]);

  const menuContext = useMemo<IBlockMenuRenderContext | null>(() => {
    if (operationMenuOpen && operationMenuContext) {
      return operationMenuContext;
    }

    const lockedContext = blockMenuService?.getMenuLockedContext();
    if (lockedContext) {
      const root = editor.getRootElement();
      const fresh = root?.querySelector<HTMLElement>(
        `[data-block-id="${CSS.escape(lockedContext.blockId)}"]`,
      );
      if (fresh && root?.contains(fresh)) {
        return {
          blockElement: fresh,
          blockId: lockedContext.blockId,
          editor,
        };
      }
    }

    if (!hoveredBlock) return null;

    return {
      blockElement: hoveredBlock.blockElement,
      blockId: hoveredBlock.blockId,
      editor,
    };
  }, [
    editor,
    hoveredBlock,
    operationMenuOpen,
    operationMenuContext,
    blockMenuService,
    menuVersion,
  ]);

  useLayoutEffect(() => {
    if (!menuContext) {
      if (operationMenuOpen) {
        return;
      }

      setMenuPosition({});
      return;
    }

    const updateMenuPosition = () => {
      const blockRect = getBlockMeasureRect(menuContext.blockElement);
      if (!blockRect) {
        setMenuPosition({});
        return;
      }

      const menuWidth = menuRef.current?.offsetWidth || 32;
      const gap = 8;
      const listItemOffset = menuContext.blockElement.tagName === 'LI' ? 16 : 0;
      const isTableBlock = isTableBlockElement(menuContext.blockElement);
      const isFocusedTableBlock = focusedTableBlockId === menuContext.blockId && isTableBlock;
      const tableMenuOffset = isFocusedTableBlock ? TABLE_FOCUSED_MENU_OFFSET : 0;
      const tableAnchorRect = isTableBlock
        ? getTableMenuAnchorRect(menuContext.blockElement)
        : null;
      const root = editor.getRootElement();
      const rootRect = root?.getBoundingClientRect();
      const rootPaddingLeft = root
        ? Number.parseFloat(window.getComputedStyle(root).paddingLeft || '0')
        : 0;
      const minTableLeft = rootRect ? rootRect.left + rootPaddingLeft : gap;
      const anchorLeft =
        isTableBlock && tableAnchorRect
          ? Math.max(tableAnchorRect.left, minTableLeft)
          : blockRect.left;
      const rawAnchorTop = tableAnchorRect?.top ?? blockRect.top;
      const anchorTop =
        rawAnchorTop >= blockRect.top - 1 && rawAnchorTop <= blockRect.bottom + 1
          ? rawAnchorTop
          : blockRect.top;
      const position = {
        left: Math.max(gap, anchorLeft - menuWidth - gap - listItemOffset - tableMenuOffset),
        top: anchorTop,
      };

      setMenuPosition(position);
    };

    updateMenuPosition();

    window.addEventListener('resize', updateMenuPosition);
    document.addEventListener('scroll', updateMenuPosition, true);

    return () => {
      window.removeEventListener('resize', updateMenuPosition);
      document.removeEventListener('scroll', updateMenuPosition, true);
    };
  }, [editor, focusedTableBlockId, menuContext, layoutVersion, operationMenuOpen]);

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
    });
  };

  const handleOperationMenuOpenChange = (open: boolean) => {
    if (contextRef.current.ignoreNextHandleClick) {
      contextRef.current.ignoreNextHandleClick = false;
      return;
    }

    if (!menuContext) return;

    if (open) {
      setOperationMenuOpen(true);
      setOperationMenuContext(menuContext);
      contextRef.current.operationMenuAnchorBlockId = menuContext.blockId;
    } else {
      setOperationMenuOpen(false);
      setOperationMenuContext(null);
      contextRef.current.operationMenuAnchorBlockId = null;
    }
  };

  const dropdownItems = useMemo<DropdownMenuProps['items']>(
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

  const shouldRenderPortal = (!blockMenuSuppressed && menuContext) || dragIndicator;

  const menuNode =
    menuContext && !isDragging && !blockMenuSuppressed ? (
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
          <DropdownMenu
            items={dropdownItems}
            onOpenChange={handleOperationMenuOpenChange}
            open={operationMenuOpen && operationMenuContext?.blockId === menuContext.blockId}
            placement={'leftTop'}
            popupProps={{ className: OPERATION_MENU_OVERLAY_CLASS }}
            positionerProps={{ style: { zIndex: 1000 } }}
          >
            <Button
              aria-label={'Block actions and drag'}
              className={styles.dragHandle}
              data-block-drag-handle={'true'}
              icon={<Icon icon={GripVerticalIcon} size={14} />}
              onPointerDown={handleDragHandlePointerDown}
              size={'small'}
              title={'Block actions and drag'}
              type={'text'}
            />
          </DropdownMenu>
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
          appElement ?? document.body,
        )}
    </>
  );
};

ReactBlockPlugin.displayName = 'ReactBlockPlugin';

export default ReactBlockPlugin;
