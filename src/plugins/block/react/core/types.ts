import { type BlockMovePayload } from '../../command';

export type BlockDragTarget = BlockMovePayload;

export interface DragBlockEntry {
  block: HTMLElement;
  blockId: string;
  rect: Pick<DOMRect, 'bottom' | 'height' | 'left' | 'top' | 'width'>;
}

export interface DragInsertionSlot {
  left: number;
  placement: 'before' | 'after';
  sourceBlockId: string;
  targetBlockId: string;
  width: number;
  y: number;
}
