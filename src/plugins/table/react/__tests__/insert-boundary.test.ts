import { describe, expect, it } from 'vitest';

import { findInsertBoundary } from '../TableGrips/geometry';

const spans = [
  { end: 140, start: 100 },
  { end: 180, start: 140 },
  { end: 220, start: 180 },
];

describe('findInsertBoundary', () => {
  it('picks the boundary between two rows near the pointer', () => {
    expect(findInsertBoundary(spans, 143)).toEqual({ index: 1, insertAfter: false, position: 140 });
  });

  it('inserts before the first and after the last', () => {
    expect(findInsertBoundary(spans, 98)).toEqual({ index: 0, insertAfter: false, position: 100 });
    expect(findInsertBoundary(spans, 224)).toEqual({ index: 2, insertAfter: true, position: 220 });
  });

  it('ignores points away from any boundary', () => {
    expect(findInsertBoundary(spans, 160)).toBeNull();
  });
});
