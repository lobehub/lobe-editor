import type { BlockDragTarget, DragBlockEntry } from './types';

export type HoveredBlockState = {
  blockElement: HTMLElement;
  blockId: string;
} | null;

export interface RuntimeContextRef {
  dragAutoScrollRaf: number | null;
  dragBlocks: DragBlockEntry[];
  dragCleanup: (() => void) | null;
  dragMoved: boolean;
  dragPointerY: number | null;
  dragRaf: number | null;
  dragStartPoint: { x: number; y: number } | null;
  dragStarted: boolean;
  dragTarget: BlockDragTarget | null;
  draggingSource: { blockElement: HTMLElement; blockId: string } | null;
  hideTimer: number | null;
  hoveredBlock: HoveredBlockState;
  ignoreNextHandleClick: boolean;
  operationMenuAnchorBlockId: string | null;
}

export const createRuntimeContext = (): RuntimeContextRef => ({
  dragAutoScrollRaf: null,
  dragBlocks: [],
  dragCleanup: null,
  dragMoved: false,
  dragPointerY: null,
  dragRaf: null,
  dragStartPoint: null,
  dragStarted: false,
  dragTarget: null,
  draggingSource: null,
  hideTimer: null,
  hoveredBlock: null,
  ignoreNextHandleClick: false,
  operationMenuAnchorBlockId: null,
});
