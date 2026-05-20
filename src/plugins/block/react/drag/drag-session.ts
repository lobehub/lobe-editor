import type { MutableRefObject } from 'react';

import type { IEditor } from '@/types';
import { createDebugLogger } from '@/utils/debug';

import { MOVE_BLOCK_COMMAND } from '../../command';
import { type IBlockMenuRenderContext } from '../../service';
import { DRAG_AUTO_SCROLL_EDGE, DRAG_START_DISTANCE } from '../core/constants';
import type { RuntimeContextRef } from '../core/runtime-context';
import type { BlockDragTarget } from '../core/types';
import {
  collectDragBlocks,
  getAutoScrollDelta,
  resolveNearestInsertionSlot,
  resolveScrollContainers,
} from './drag-utils';

const logger = createDebugLogger('plugin', 'block-react');

type DragIndicator = {
  left: number;
  top: number;
  width: number;
};

interface StartBlockDragSessionParams {
  clearDragPreview: () => void;
  clientX: number;
  clientY: number;
  contextRef: MutableRefObject<RuntimeContextRef>;
  editor: IEditor;
  menuContext: IBlockMenuRenderContext;
  onDragTargetResolve?: (target: BlockDragTarget | null) => void;
  setDragIndicator: (value: DragIndicator | null) => void;
  setOperationMenuContext: (value: IBlockMenuRenderContext | null) => void;
  setOperationMenuOpen: (value: boolean) => void;
  toggleOperationMenu: (context: IBlockMenuRenderContext | null) => void;
}

const DRAG_GHOST_OFFSET_X = 14;
const DRAG_GHOST_OFFSET_Y = 14;
const DRAG_SOURCE_OPACITY = '0.45';

const createDragGhost = (sourceBlock: HTMLElement, x: number, y: number): HTMLDivElement => {
  const rect = sourceBlock.getBoundingClientRect();
  const ghost = document.createElement('div');
  const clone = sourceBlock.cloneNode(true) as HTMLElement;

  ghost.dataset.blockDragGhost = 'true';
  ghost.setAttribute('aria-hidden', 'true');
  ghost.style.position = 'fixed';
  ghost.style.top = '0';
  ghost.style.left = '0';
  ghost.style.pointerEvents = 'none';
  ghost.style.zIndex = '10001';
  ghost.style.opacity = '0.5';
  ghost.style.width = `${rect.width}px`;
  ghost.style.height = `${rect.height}px`;
  ghost.style.overflow = 'hidden';
  ghost.style.borderRadius = '8px';
  ghost.style.boxShadow =
    '0 10px 30px rgba(0, 0, 0, 0.12), 0 0 0 1px var(--lobe-color-border-secondary, rgba(0, 0, 0, 0.06)) inset';
  ghost.style.transform = `translate3d(${x + DRAG_GHOST_OFFSET_X}px, ${y + DRAG_GHOST_OFFSET_Y}px, 0)`;

  clone.style.margin = '0';
  clone.style.pointerEvents = 'none';
  clone.style.width = '100%';
  clone.style.height = '100%';

  ghost.append(clone);
  document.body.append(ghost);

  return ghost;
};

const updateDragGhostPosition = (ghost: HTMLDivElement, x: number, y: number) => {
  ghost.style.transform = `translate3d(${x + DRAG_GHOST_OFFSET_X}px, ${y + DRAG_GHOST_OFFSET_Y}px, 0)`;
};

const removeDragGhost = (ghost: HTMLDivElement | null) => {
  if (!ghost) return;
  ghost.remove();
};

const applyDragSourceOpacity = (sourceBlock: HTMLElement): (() => void) => {
  const previousOpacity = sourceBlock.style.opacity;
  sourceBlock.style.opacity = DRAG_SOURCE_OPACITY;

  return () => {
    sourceBlock.style.opacity = previousOpacity;
  };
};

export const startBlockDragSession = ({
  clientX,
  clientY,
  clearDragPreview,
  contextRef,
  editor,
  menuContext,
  onDragTargetResolve,
  setDragIndicator,
  setOperationMenuContext,
  setOperationMenuOpen,
  toggleOperationMenu,
}: StartBlockDragSessionParams) => {
  setOperationMenuOpen(false);
  let dragGhost: HTMLDivElement | null = null;
  let restoreSourceOpacity: (() => void) | null = null;

  contextRef.current.dragStartPoint = { x: clientX, y: clientY };
  contextRef.current.dragStarted = false;
  contextRef.current.dragMoved = false;

  contextRef.current.dragCleanup?.();
  contextRef.current.dragCleanup = null;

  if (contextRef.current.hideTimer !== null) {
    window.clearTimeout(contextRef.current.hideTimer);
    contextRef.current.hideTimer = null;
  }

  contextRef.current.draggingSource = {
    blockElement: menuContext.blockElement,
    blockId: menuContext.blockId,
  };
  contextRef.current.dragPointerY = clientY;
  contextRef.current.dragBlocks = collectDragBlocks(editor.getRootElement());

  const refreshDragBlocksSnapshot = () => {
    const source = contextRef.current.draggingSource;
    if (!source) return;

    contextRef.current.dragBlocks = collectDragBlocks(editor.getRootElement());
  };

  const updateDragPreview = (y: number) => {
    const source = contextRef.current.draggingSource;
    const blocks = contextRef.current.dragBlocks;

    if (!source || blocks.length === 0) {
      clearDragPreview();
      return;
    }

    const bestSlot = resolveNearestInsertionSlot(source.blockId, blocks, y);
    if (!bestSlot) {
      clearDragPreview();
      return;
    }

    contextRef.current.dragTarget = {
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

  const scrollContainers = resolveScrollContainers(editor.getRootElement());

  const onPointerMove = (pointerEvent: PointerEvent) => {
    contextRef.current.dragPointerY = pointerEvent.clientY;

    if (!contextRef.current.dragStarted && contextRef.current.dragStartPoint) {
      const distance = Math.hypot(
        pointerEvent.clientX - contextRef.current.dragStartPoint.x,
        pointerEvent.clientY - contextRef.current.dragStartPoint.y,
      );

      if (distance >= DRAG_START_DISTANCE) {
        contextRef.current.dragStarted = true;
        contextRef.current.dragMoved = true;
        contextRef.current.ignoreNextHandleClick = true;
        setOperationMenuOpen(false);
        setOperationMenuContext(null);

        if (!dragGhost && contextRef.current.draggingSource) {
          dragGhost = createDragGhost(
            contextRef.current.draggingSource.blockElement,
            pointerEvent.clientX,
            pointerEvent.clientY,
          );

          if (!restoreSourceOpacity) {
            restoreSourceOpacity = applyDragSourceOpacity(
              contextRef.current.draggingSource.blockElement,
            );
          }
        }
      }
    }

    if (!contextRef.current.dragStarted) {
      return;
    }

    if (dragGhost) {
      updateDragGhostPosition(dragGhost, pointerEvent.clientX, pointerEvent.clientY);
    }

    if (contextRef.current.dragRaf !== null) return;

    contextRef.current.dragRaf = window.requestAnimationFrame(() => {
      contextRef.current.dragRaf = null;

      if (contextRef.current.dragPointerY === null) {
        clearDragPreview();
        return;
      }

      updateDragPreview(contextRef.current.dragPointerY);
    });
  };

  const onViewportChange = () => {
    refreshDragBlocksSnapshot();

    if (contextRef.current.dragPointerY !== null) {
      updateDragPreview(contextRef.current.dragPointerY);
    }
  };

  const onPointerUp = () => {
    if (!contextRef.current.dragStarted && !contextRef.current.dragMoved) {
      toggleOperationMenu(menuContext);
      // Pointerup may be followed by click; consume it to avoid immediate double toggle.
      contextRef.current.ignoreNextHandleClick = true;

      contextRef.current.draggingSource = null;
      contextRef.current.dragPointerY = null;
      contextRef.current.dragBlocks = [];
      contextRef.current.dragStartPoint = null;
      removeDragGhost(dragGhost);
      dragGhost = null;
      restoreSourceOpacity?.();
      restoreSourceOpacity = null;

      window.removeEventListener('pointermove', onPointerMove, true);
      window.removeEventListener('pointerup', onPointerUp, true);
      window.removeEventListener('resize', onViewportChange);
      document.removeEventListener('scroll', onViewportChange, true);

      contextRef.current.dragCleanup = null;
      return;
    }

    const finalTarget = contextRef.current.dragTarget;

    if (finalTarget) {
      logger.debug('drag-end', {
        位置: finalTarget.placement === 'before' ? '上方' : '下方',
        位置节点id: finalTarget.targetBlockId,
        插入节点id: finalTarget.sourceBlockId,
      });

      const handled = editor.dispatchCommand(MOVE_BLOCK_COMMAND, finalTarget);
      logger.debug('move-block-command-handled', handled);
    }

    onDragTargetResolve?.(contextRef.current.dragTarget);

    if (contextRef.current.dragRaf !== null) {
      window.cancelAnimationFrame(contextRef.current.dragRaf);
      contextRef.current.dragRaf = null;
    }

    if (contextRef.current.dragAutoScrollRaf !== null) {
      window.cancelAnimationFrame(contextRef.current.dragAutoScrollRaf);
      contextRef.current.dragAutoScrollRaf = null;
    }

    contextRef.current.draggingSource = null;
    contextRef.current.dragPointerY = null;
    contextRef.current.dragBlocks = [];
    contextRef.current.dragStartPoint = null;
    removeDragGhost(dragGhost);
    dragGhost = null;
    restoreSourceOpacity?.();
    restoreSourceOpacity = null;
    clearDragPreview();

    window.removeEventListener('pointermove', onPointerMove, true);
    window.removeEventListener('pointerup', onPointerUp, true);
    window.removeEventListener('resize', onViewportChange);
    document.removeEventListener('scroll', onViewportChange, true);

    contextRef.current.dragCleanup = null;
  };

  window.addEventListener('pointermove', onPointerMove, true);
  window.addEventListener('pointerup', onPointerUp, true);
  window.addEventListener('resize', onViewportChange);
  document.addEventListener('scroll', onViewportChange, true);

  const runAutoScroll = () => {
    contextRef.current.dragAutoScrollRaf = window.requestAnimationFrame(runAutoScroll);

    if (
      !contextRef.current.draggingSource ||
      contextRef.current.dragPointerY === null ||
      !contextRef.current.dragStarted
    ) {
      return;
    }

    let didScroll = false;

    for (const scrollContainer of scrollContainers) {
      const delta = getAutoScrollDelta(contextRef.current.dragPointerY, scrollContainer);
      if (delta === 0) {
        continue;
      }

      const maxScrollTop = scrollContainer.scrollHeight - scrollContainer.clientHeight;
      const nextScrollTop = Math.max(0, Math.min(maxScrollTop, scrollContainer.scrollTop + delta));

      if (nextScrollTop === scrollContainer.scrollTop) {
        continue;
      }

      scrollContainer.scrollTop = nextScrollTop;
      didScroll = true;
    }

    if (didScroll) {
      refreshDragBlocksSnapshot();

      if (contextRef.current.dragPointerY !== null) {
        updateDragPreview(contextRef.current.dragPointerY);
      }

      return;
    }

    const blocks = contextRef.current.dragBlocks;
    if (blocks.length === 0) {
      return;
    }

    const pointerY = contextRef.current.dragPointerY;
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

    if (contextRef.current.dragPointerY !== null) {
      updateDragPreview(contextRef.current.dragPointerY);
    }
  };

  contextRef.current.dragAutoScrollRaf = window.requestAnimationFrame(runAutoScroll);

  contextRef.current.dragCleanup = () => {
    if (contextRef.current.dragRaf !== null) {
      window.cancelAnimationFrame(contextRef.current.dragRaf);
      contextRef.current.dragRaf = null;
    }

    if (contextRef.current.dragAutoScrollRaf !== null) {
      window.cancelAnimationFrame(contextRef.current.dragAutoScrollRaf);
      contextRef.current.dragAutoScrollRaf = null;
    }

    contextRef.current.draggingSource = null;
    contextRef.current.dragPointerY = null;
    contextRef.current.dragBlocks = [];
    contextRef.current.dragStartPoint = null;
    removeDragGhost(dragGhost);
    dragGhost = null;
    restoreSourceOpacity?.();
    restoreSourceOpacity = null;
    clearDragPreview();

    window.removeEventListener('pointermove', onPointerMove, true);
    window.removeEventListener('pointerup', onPointerUp, true);
    window.removeEventListener('resize', onViewportChange);
    document.removeEventListener('scroll', onViewportChange, true);
  };
};
