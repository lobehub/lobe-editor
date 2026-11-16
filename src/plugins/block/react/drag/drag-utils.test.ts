import { describe, expect, it, vi } from 'vitest';

import {
  BLOCK_MENU_ANCHOR_ATTRIBUTE,
  BLOCK_STRUCTURAL_ID_ATTRIBUTE,
} from '../core/types';
import {
  collectDragBlocks,
  getBlockMenuAnchor,
  getBlockMeasureRect,
  resolveNearestInsertionSlot,
} from './drag-utils';

describe('block visual menu anchors', () => {
  it('keeps the host box for drag geometry and reads the marked visual anchor for menu layout', () => {
    const block = document.createElement('div');
    const anchor = document.createElement('div');
    block.dataset.blockId = 'artifact';
    anchor.setAttribute(BLOCK_MENU_ANCHOR_ATTRIBUTE, 'center');
    block.append(anchor);

    vi.spyOn(block, 'getBoundingClientRect').mockReturnValue(new DOMRect(10, 20, 400, 491));
    vi.spyOn(anchor, 'getBoundingClientRect').mockReturnValue(new DOMRect(10, 36, 400, 39));

    expect(getBlockMeasureRect(block)).toMatchObject({
      bottom: 511,
      height: 491,
      left: 10,
      top: 20,
      width: 400,
    });
    expect(getBlockMenuAnchor(block)).toEqual({
      alignment: 'center',
      rect: {
        bottom: 75,
        height: 39,
        left: 10,
        top: 36,
        width: 400,
      },
    });
  });

  it('ignores an unrecognised or zero-sized anchor marker', () => {
    const block = document.createElement('div');
    const anchor = document.createElement('div');
    anchor.setAttribute(BLOCK_MENU_ANCHOR_ATTRIBUTE, 'middle');
    block.append(anchor);
    vi.spyOn(anchor, 'getBoundingClientRect').mockReturnValue(new DOMRect(0, 0, 0, 0));

    expect(getBlockMenuAnchor(block)).toBeNull();
  });

  it('does not borrow an anchor from a nested block', () => {
    const block = document.createElement('section');
    const nestedBlock = document.createElement('div');
    const anchor = document.createElement('div');
    block.dataset.blockId = 'outer';
    nestedBlock.dataset.blockId = 'nested';
    anchor.setAttribute(BLOCK_MENU_ANCHOR_ATTRIBUTE, 'center');
    nestedBlock.append(anchor);
    block.append(nestedBlock);

    vi.spyOn(anchor, 'getBoundingClientRect').mockReturnValue(new DOMRect(0, 0, 100, 20));

    expect(getBlockMenuAnchor(block)).toBeNull();
  });

  it('keeps logical ids for hover and structural ids for drag payloads', () => {
    const root = document.createElement('div');
    const artifactHost = document.createElement('div');
    const paragraphHost = document.createElement('p');
    artifactHost.dataset.blockId = 'artifact-key';
    artifactHost.setAttribute(BLOCK_STRUCTURAL_ID_ATTRIBUTE, 'hole-key');
    paragraphHost.dataset.blockId = 'paragraph-key';
    paragraphHost.setAttribute(BLOCK_STRUCTURAL_ID_ATTRIBUTE, 'paragraph-key');
    root.append(artifactHost, paragraphHost);

    vi.spyOn(artifactHost, 'getBoundingClientRect').mockReturnValue(
      new DOMRect(10, 20, 400, 100),
    );
    vi.spyOn(paragraphHost, 'getBoundingClientRect').mockReturnValue(
      new DOMRect(10, 140, 400, 40),
    );

    const blocks = collectDragBlocks(root);
    expect(blocks.map(({ blockId, structuralBlockId }) => ({ blockId, structuralBlockId }))).toEqual([
      { blockId: 'artifact-key', structuralBlockId: 'hole-key' },
      { blockId: 'paragraph-key', structuralBlockId: 'paragraph-key' },
    ]);
    expect(resolveNearestInsertionSlot('hole-key', blocks, 180)).toMatchObject({
      sourceBlockId: 'hole-key',
      targetBlockId: 'paragraph-key',
    });
  });
});
