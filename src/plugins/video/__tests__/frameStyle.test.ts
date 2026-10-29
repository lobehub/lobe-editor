import { describe, expect, it } from 'vitest';

import { getVideoFrameStyle } from '../utils/frameStyle';

describe('getVideoFrameStyle', () => {
  it('caps auto mode at the intrinsic width', () => {
    expect(getVideoFrameStyle({ mode: 'auto' }, 480)).toEqual({ width: 'min(480px, 100%)' });
  });

  it('falls back to full width in auto mode before metadata loads', () => {
    expect(getVideoFrameStyle({ mode: 'auto' }, undefined)).toEqual({});
  });

  it('uses the chosen tier otherwise', () => {
    expect(getVideoFrameStyle({ mode: 'percent', value: 50 }, 480)).toEqual({ width: '50%' });
    expect(getVideoFrameStyle({ mode: 'px', px: 320 }, 480)).toEqual({
      maxWidth: '100%',
      width: 'min(320px, 100%)',
    });
  });
});
