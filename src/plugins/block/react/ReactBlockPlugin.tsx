'use client';

import { Icon } from '@lobehub/ui';
import { cx } from 'antd-style';
import { $getNodeByKey } from 'lexical';
import { GripVerticalIcon } from 'lucide-react';
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

import { useLexicalComposerContext } from '@/editor-kernel/react/react-context';
import { useTranslation } from '@/editor-kernel/react/useTranslation';
import { ILocaleKeys } from '@/types';
import { createDebugLogger } from '@/utils/debug';

import { type BlockMovePayload, MOVE_BLOCK_COMMAND } from '../command';
import { BlockPlugin, type BlockPluginOptions } from '../plugin';
import { type IBlockMenuRenderContext, IBlockMenuService } from '../service';
import { styles } from './style';

export interface ReactBlockPluginProps extends Omit<BlockPluginOptions, 'className'> {
  className?: string;
  locale?: Partial<Record<keyof ILocaleKeys, string>>;
  onDragTargetChange?: (target: BlockDragTarget | null) => void;
  onDragTargetResolve?: (target: BlockDragTarget | null) => void;
  onHoverBlockChange?: (context: IBlockMenuRenderContext | null) => void;
  rootClassName?: string;
}

export type BlockDragTarget = BlockMovePayload;

interface DragBlockEntry {
  block: HTMLElement;
  blockId: string;
  rect: Pick<DOMRect, 'bottom' | 'height' | 'left' | 'top' | 'width'>;
}

interface DragInsertionSlot {
  left: number;
  placement: 'before' | 'after';
  sourceBlockId: string;
  targetBlockId: string;
  width: number;
  y: number;
}

const HOVER_HIDE_DELAY = 120;
const DRAG_AUTO_SCROLL_EDGE = 80;
const DRAG_AUTO_SCROLL_MAX_STEP = 18;
const DRAG_START_DISTANCE = 4;
const logger = createDebugLogger('plugin', 'block-react');

const ReactBlockPlugin: FC<ReactBlockPluginProps> = (props) => {
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
  const t = useTranslation();
  const menuRef = useRef<HTMLDivElement>(null);
  const operationMenuRef = useRef<HTMLDivElement>(null);
  const [hoveredBlock, setHoveredBlock] = useState<{
    blockElement: HTMLElement;
    blockId: string;
  } | null>(null);
  const hoveredBlockRef = useRef<typeof hoveredBlock>(null);
  const hideTimerRef = useRef<number | null>(null);
  const operationMenuAnchorBlockIdRef = useRef<string | null>(null);
  const dragCleanupRef = useRef<(() => void) | null>(null);
  const dragTargetRef = useRef<BlockDragTarget | null>(null);
  const draggingSourceRef = useRef<{ blockElement: HTMLElement; blockId: string } | null>(null);
  const dragBlocksRef = useRef<DragBlockEntry[]>([]);
  const dragRafRef = useRef<number | null>(null);
  const dragPointerYRef = useRef<number | null>(null);
  const dragAutoScrollRafRef = useRef<number | null>(null);
  const dragStartPointRef = useRef<{ x: number; y: number } | null>(null);
  const dragStartedRef = useRef(false);
  const dragMovedRef = useRef(false);
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
  const [blockMenuService, setBlockMenuService] = useState(() =>
    editor.requireService(IBlockMenuService),
  );

  useLayoutEffect(() => {
    if (locale) {
      editor.registerLocale(locale);
    }

    editor.registerPlugin(BlockPlugin, {
      attributeName,
      className: mergedRootClassName,
    });

    setBlockMenuService(editor.requireService(IBlockMenuService));
  }, [attributeName, editor, locale, mergedRootClassName]);

  useEffect(() => {
    hoveredBlockRef.current = hoveredBlock;
  }, [hoveredBlock]);

  useEffect(() => {
    if (!blockMenuService) return;

    return blockMenuService.subscribe(() => {
      setMenuVersion((v) => v + 1);
    });
  }, [blockMenuService]);

  useEffect(() => {
    if (!blockMenuService) return;

    return blockMenuService.registerMenu({
      key: '__block_default_delete',
      order: 999,
      render: (context) => {
        const handleDelete = () => {
          const lexicalEditor = context.editor.getLexicalEditor();
          if (!lexicalEditor) return;

          lexicalEditor.update(() => {
            const target = $getNodeByKey(context.blockId);
            if (!target) return;
            target.remove();
          });

          setOperationMenuOpen(false);
          setOperationMenuContext(null);
        };

        return (
          <button className={styles.operationMenuItem} onClick={handleDelete} type={'button'}>
            {t('block.delete')}
          </button>
        );
      },
    });
  }, [blockMenuService, t]);

  useEffect(() => {
    return () => {
      dragCleanupRef.current?.();
      dragCleanupRef.current = null;
    };
  }, []);

  useEffect(() => {
    const getHoveredBlock = (target: EventTarget | null) => {
      const root = editor.getRootElement();

      if (!root || !(target instanceof Node)) {
        return null;
      }

      const targetElement = target instanceof Element ? target : target.parentElement;
      if (!targetElement) {
        return null;
      }

      if (menuRef.current?.contains(targetElement)) {
        return hoveredBlockRef.current;
      }

      if (operationMenuRef.current?.contains(targetElement)) {
        return hoveredBlockRef.current;
      }

      const blockElement = targetElement.closest('[data-block-id]');

      if (!(blockElement instanceof HTMLElement) || !root.contains(blockElement)) {
        return null;
      }

      const blockId = blockElement.dataset.blockId;
      if (!blockId) {
        return null;
      }

      return { blockElement, blockId };
    };

    const handleMouseMove = (event: MouseEvent) => {
      if (draggingSourceRef.current) {
        return;
      }

      const next = getHoveredBlock(event.target);

      if (next) {
        if (hideTimerRef.current !== null) {
          window.clearTimeout(hideTimerRef.current);
          hideTimerRef.current = null;
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

      if (hideTimerRef.current !== null) {
        return;
      }

      hideTimerRef.current = window.setTimeout(() => {
        hideTimerRef.current = null;
        setHoveredBlock((current) => (current ? null : current));
      }, HOVER_HIDE_DELAY);
    };

    document.addEventListener('mousemove', handleMouseMove, true);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove, true);

      if (hideTimerRef.current !== null) {
        window.clearTimeout(hideTimerRef.current);
        hideTimerRef.current = null;
      }
    };
  }, [editor]);

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
      const menuWidth = menuRef.current?.offsetWidth || 24;
      const gap = 8;

      setMenuPosition({
        left: Math.max(gap, rect.left - menuWidth - gap),
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

  useEffect(() => {
    onHoverBlockChange?.(menuContext);
  }, [menuContext, onHoverBlockChange]);

  useEffect(() => {
    if (!operationMenuOpen || !menuContext || !operationMenuAnchorBlockIdRef.current) {
      return;
    }

    if (operationMenuAnchorBlockIdRef.current !== menuContext.blockId) {
      setOperationMenuOpen(false);
      setOperationMenuContext(null);
    }
  }, [menuContext, operationMenuOpen]);

  useEffect(() => {
    if (!operationMenuOpen) {
      operationMenuAnchorBlockIdRef.current = null;
      setOperationMenuContext(null);
    }
  }, [operationMenuOpen]);

  useEffect(() => {
    onDragTargetChange?.(dragTargetRef.current);
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
    dragTargetRef.current = null;
    setDragIndicator(null);
  };

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const collectDragBlocks = (_sourceBlockId: string): DragBlockEntry[] => {
    const root = editor.getRootElement();
    if (!root) return [];

    return Array.from(root.querySelectorAll<HTMLElement>('[data-block-id]'))
      .reduce<DragBlockEntry[]>((acc, block) => {
        const blockId = block.dataset.blockId;
        if (!blockId) return acc;

        const rect = block.getBoundingClientRect();
        if (rect.height <= 0) return acc;

        acc.push({
          block,
          blockId,
          rect: {
            bottom: rect.bottom,
            height: rect.height,
            left: rect.left,
            top: rect.top,
            width: rect.width,
          },
        });
        return acc;
      }, [])
      .sort((a, b) => a.rect.top - b.rect.top);
  };

  const resolveScrollContainers = (): HTMLElement[] => {
    const root = editor.getRootElement();
    if (!root) return [];

    let element: HTMLElement | null = root;
    const containers: HTMLElement[] = [];

    while (element) {
      const style = window.getComputedStyle(element);
      const overflowY = style.overflowY;
      const scrollable =
        (overflowY === 'auto' || overflowY === 'scroll') &&
        element.scrollHeight > element.clientHeight;

      if (scrollable) {
        containers.push(element);
      }

      element = element.parentElement;
    }

    const pageScroller = document.scrollingElement as HTMLElement | null;
    if (pageScroller && !containers.includes(pageScroller)) {
      containers.push(pageScroller);
    }

    return containers;
  };

  const getAutoScrollDelta = (pointerY: number, container: HTMLElement): number => {
    const isPageScroller = container === document.scrollingElement;

    const top = isPageScroller ? 0 : container.getBoundingClientRect().top;
    const bottom = isPageScroller ? window.innerHeight : container.getBoundingClientRect().bottom;

    if (pointerY < top + DRAG_AUTO_SCROLL_EDGE) {
      const ratio = (top + DRAG_AUTO_SCROLL_EDGE - pointerY) / DRAG_AUTO_SCROLL_EDGE;
      return -Math.max(1, Math.round(ratio * DRAG_AUTO_SCROLL_MAX_STEP));
    }

    if (pointerY > bottom - DRAG_AUTO_SCROLL_EDGE) {
      const ratio = (pointerY - (bottom - DRAG_AUTO_SCROLL_EDGE)) / DRAG_AUTO_SCROLL_EDGE;
      return Math.max(1, Math.round(ratio * DRAG_AUTO_SCROLL_MAX_STEP));
    }

    return 0;
  };

  const refreshDragBlocksSnapshot = () => {
    const source = draggingSourceRef.current;
    if (!source) return;

    dragBlocksRef.current = collectDragBlocks(source.blockId);
  };

  const updateDragPreview = (y: number) => {
    const source = draggingSourceRef.current;
    const blocks = dragBlocksRef.current;

    if (!source || blocks.length === 0) {
      clearDragPreview();
      return;
    }

    const slots: DragInsertionSlot[] = [];

    const first = blocks[0];
    slots.push({
      left: first.rect.left,
      placement: 'before',
      sourceBlockId: source.blockId,
      targetBlockId: first.blockId,
      width: first.rect.width,
      y: first.rect.top,
    });

    for (let i = 0; i < blocks.length - 1; i++) {
      const next = blocks[i + 1];

      // Aggregate "current after" + "next before" into a single boundary slot.
      slots.push({
        left: next.rect.left,
        placement: 'before',
        sourceBlockId: source.blockId,
        targetBlockId: next.blockId,
        width: next.rect.width,
        y: next.rect.top,
      });
    }

    // eslint-disable-next-line unicorn/prefer-at
    const last = blocks[blocks.length - 1];
    slots.push({
      left: last.rect.left,
      placement: 'after',
      sourceBlockId: source.blockId,
      targetBlockId: last.blockId,
      width: last.rect.width,
      y: last.rect.bottom,
    });

    let bestSlot = slots[0];
    let bestDistance = Math.abs(y - bestSlot.y);

    for (let i = 1; i < slots.length; i++) {
      const slot = slots[i];
      const distance = Math.abs(y - slot.y);

      if (distance < bestDistance) {
        bestSlot = slot;
        bestDistance = distance;
      }
    }

    dragTargetRef.current = {
      placement: bestSlot.placement,
      sourceBlockId: bestSlot.sourceBlockId,
      targetBlockId: bestSlot.targetBlockId,
    };

    setDragIndicator({
      left: bestSlot.left,
      top: bestSlot.y,
      width: bestSlot.width,
    });
  };

  const handleDragHandlePointerDown = (event: ReactPointerEvent<HTMLElement>) => {
    if (!menuContext) return;

    event.preventDefault();
    event.stopPropagation();

    setOperationMenuOpen(false);

    dragStartPointRef.current = { x: event.clientX, y: event.clientY };
    dragStartedRef.current = false;
    dragMovedRef.current = false;

    dragCleanupRef.current?.();
    dragCleanupRef.current = null;

    if (hideTimerRef.current !== null) {
      window.clearTimeout(hideTimerRef.current);
      hideTimerRef.current = null;
    }

    draggingSourceRef.current = {
      blockElement: menuContext.blockElement,
      blockId: menuContext.blockId,
    };
    dragPointerYRef.current = event.clientY;
    dragBlocksRef.current = collectDragBlocks(menuContext.blockId);

    const scrollContainers = resolveScrollContainers();

    const onPointerMove = (pointerEvent: PointerEvent) => {
      dragPointerYRef.current = pointerEvent.clientY;

      if (!dragStartedRef.current && dragStartPointRef.current) {
        const distance = Math.hypot(
          pointerEvent.clientX - dragStartPointRef.current.x,
          pointerEvent.clientY - dragStartPointRef.current.y,
        );

        if (distance >= DRAG_START_DISTANCE) {
          dragStartedRef.current = true;
          dragMovedRef.current = true;
          setOperationMenuOpen(false);
          setOperationMenuContext(null);
        }
      }

      if (!dragStartedRef.current) {
        return;
      }

      if (dragRafRef.current !== null) return;

      dragRafRef.current = window.requestAnimationFrame(() => {
        dragRafRef.current = null;

        if (dragPointerYRef.current === null) {
          clearDragPreview();
          return;
        }

        updateDragPreview(dragPointerYRef.current);
      });
    };

    const onViewportChange = () => {
      refreshDragBlocksSnapshot();

      if (dragPointerYRef.current !== null) {
        updateDragPreview(dragPointerYRef.current);
      }
    };

    const onPointerUp = () => {
      if (!dragStartedRef.current && !dragMovedRef.current) {
        setOperationMenuOpen((open) => {
          if (!menuContext) {
            setOperationMenuContext(null);
            return false;
          }

          const shouldOpen = !(
            open && operationMenuAnchorBlockIdRef.current === menuContext.blockId
          );
          operationMenuAnchorBlockIdRef.current = shouldOpen ? menuContext.blockId : null;
          setOperationMenuContext(shouldOpen ? menuContext : null);
          return shouldOpen;
        });

        draggingSourceRef.current = null;
        dragPointerYRef.current = null;
        dragBlocksRef.current = [];
        dragStartPointRef.current = null;

        window.removeEventListener('pointermove', onPointerMove, true);
        window.removeEventListener('pointerup', onPointerUp, true);
        window.removeEventListener('resize', onViewportChange);
        document.removeEventListener('scroll', onViewportChange, true);

        dragCleanupRef.current = null;
        return;
      }

      const finalTarget = dragTargetRef.current;

      if (finalTarget) {
        logger.debug('drag-end', {
          位置: finalTarget.placement === 'before' ? '上方' : '下方',
          位置节点id: finalTarget.targetBlockId,
          插入节点id: finalTarget.sourceBlockId,
        });

        const handled = editor.dispatchCommand(MOVE_BLOCK_COMMAND, finalTarget);
        logger.debug('move-block-command-handled', handled);
      }

      onDragTargetResolve?.(dragTargetRef.current);

      if (dragRafRef.current !== null) {
        window.cancelAnimationFrame(dragRafRef.current);
        dragRafRef.current = null;
      }

      if (dragAutoScrollRafRef.current !== null) {
        window.cancelAnimationFrame(dragAutoScrollRafRef.current);
        dragAutoScrollRafRef.current = null;
      }

      draggingSourceRef.current = null;
      dragPointerYRef.current = null;
      dragBlocksRef.current = [];
      dragStartPointRef.current = null;
      clearDragPreview();

      window.removeEventListener('pointermove', onPointerMove, true);
      window.removeEventListener('pointerup', onPointerUp, true);
      window.removeEventListener('resize', onViewportChange);
      document.removeEventListener('scroll', onViewportChange, true);

      dragCleanupRef.current = null;
    };

    window.addEventListener('pointermove', onPointerMove, true);
    window.addEventListener('pointerup', onPointerUp, true);
    window.addEventListener('resize', onViewportChange);
    document.addEventListener('scroll', onViewportChange, true);

    const runAutoScroll = () => {
      dragAutoScrollRafRef.current = window.requestAnimationFrame(runAutoScroll);

      if (
        !draggingSourceRef.current ||
        dragPointerYRef.current === null ||
        !dragStartedRef.current
      ) {
        return;
      }

      let didScroll = false;

      for (const scrollContainer of scrollContainers) {
        const delta = getAutoScrollDelta(dragPointerYRef.current, scrollContainer);
        if (delta === 0) {
          continue;
        }

        const maxScrollTop = scrollContainer.scrollHeight - scrollContainer.clientHeight;
        const nextScrollTop = Math.max(
          0,
          Math.min(maxScrollTop, scrollContainer.scrollTop + delta),
        );

        if (nextScrollTop === scrollContainer.scrollTop) {
          continue;
        }

        scrollContainer.scrollTop = nextScrollTop;
        didScroll = true;
      }

      if (didScroll) {
        refreshDragBlocksSnapshot();

        if (dragPointerYRef.current !== null) {
          updateDragPreview(dragPointerYRef.current);
        }

        return;
      }

      const blocks = dragBlocksRef.current;
      if (blocks.length === 0) {
        return;
      }

      const pointerY = dragPointerYRef.current;
      const nearBottom = pointerY > window.innerHeight - DRAG_AUTO_SCROLL_EDGE;
      const nearTop = pointerY < DRAG_AUTO_SCROLL_EDGE;
      // eslint-disable-next-line unicorn/prefer-at
      const lastBlock = blocks[blocks.length - 1];

      if (nearBottom) {
        lastBlock.block.scrollIntoView({ block: 'end' });
      } else if (nearTop) {
        blocks[0].block.scrollIntoView({ block: 'start' });
      }

      refreshDragBlocksSnapshot();

      if (dragPointerYRef.current !== null) {
        updateDragPreview(dragPointerYRef.current);
      }
    };

    dragAutoScrollRafRef.current = window.requestAnimationFrame(runAutoScroll);

    dragCleanupRef.current = () => {
      if (dragRafRef.current !== null) {
        window.cancelAnimationFrame(dragRafRef.current);
        dragRafRef.current = null;
      }

      if (dragAutoScrollRafRef.current !== null) {
        window.cancelAnimationFrame(dragAutoScrollRafRef.current);
        dragAutoScrollRafRef.current = null;
      }

      draggingSourceRef.current = null;
      dragPointerYRef.current = null;
      dragBlocksRef.current = [];
      dragStartPointRef.current = null;
      clearDragPreview();

      window.removeEventListener('pointermove', onPointerMove, true);
      window.removeEventListener('pointerup', onPointerUp, true);
      window.removeEventListener('resize', onViewportChange);
      document.removeEventListener('scroll', onViewportChange, true);
    };
  };

  if (!menuContext && !dragIndicator && !(operationMenuOpen && operationMenuContext)) return null;

  const menuNode = menuContext ? (
    <div
      className={styles.menu}
      onMouseDown={preventEditorSelectionLost}
      ref={menuRef}
      style={menuPosition}
    >
      <div className={styles.menuInner}>
        <div
          aria-label={'Block actions and drag'}
          className={styles.dragHandle}
          data-block-drag-handle={'true'}
          draggable={false}
          onPointerDown={handleDragHandlePointerDown}
          role={'button'}
          tabIndex={-1}
          title={'Block actions and drag'}
        >
          <Icon icon={GripVerticalIcon} size={14} />
        </div>
      </div>
    </div>
  ) : null;

  const operationMenuNode = operationMenuContext &&
    operationMenuOpen &&
    operationMenus.length > 0 && (
      <div
        className={styles.operationMenu}
        onMouseDown={(event) => event.preventDefault()}
        ref={operationMenuRef}
        style={{
          right: Math.max(8, window.innerWidth - Number(menuPosition.left || 0) + 4),
          top: Number(menuPosition.top || 0),
        }}
      >
        {operationMenus.map((item) => (
          <div key={item.key}>{item.render(operationMenuContext)}</div>
        ))}
      </div>
    );

  return createPortal(
    <>
      {menuNode}
      {operationMenuNode}
      {dragIndicator && (
        <div
          className={styles.dragIndicator}
          style={{
            left: dragIndicator.left,
            top: dragIndicator.top,
            width: dragIndicator.width,
          }}
        />
      )}
    </>,
    document.body,
  );
};

ReactBlockPlugin.displayName = 'ReactBlockPlugin';

export default ReactBlockPlugin;
