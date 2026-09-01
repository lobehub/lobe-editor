import { type BlockMovePayload } from '../../command';

export { BLOCK_STRUCTURAL_ID_ATTRIBUTE } from '../../constants';

/** Attribute used by block renderers to expose the visual surface used for menu positioning. */
export const BLOCK_MENU_ANCHOR_ATTRIBUTE = 'data-block-menu-anchor';

export type BlockMenuAnchorAlignment = 'center' | 'top';

export type BlockDragTarget = BlockMovePayload;

export interface DragBlockEntry {
  block: HTMLElement;
  blockId: string;
  rect: Pick<DOMRect, 'bottom' | 'height' | 'left' | 'top' | 'width'>;
  structuralBlockId?: string;
}

export interface DragInsertionSlot {
  left: number;
  placement: 'before' | 'after';
  sourceBlockId: string;
  targetBlockId: string;
  width: number;
  y: number;
}

export interface BlockMenuAnchor {
  alignment: BlockMenuAnchorAlignment;
  rect: DragBlockEntry['rect'];
}
