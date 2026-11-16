import { describe, expect, it } from 'vitest';

import {
  getMediaDisplayStyle,
  mediaDisplayFieldsFromSize,
  mediaDisplaySizeAfterResize,
  resolveMediaDisplaySize,
  sanitizeMediaDisplayWidth,
  sanitizeMediaFixedPx,
  snapMediaDisplayPercent,
} from '../mediaDisplaySize';

describe('resolveMediaDisplaySize', () => {
  it('prefers displayWidth over fixedWidth', () => {
    expect(resolveMediaDisplaySize({ displayWidth: 75, fixedWidth: 560 })).toEqual({
      mode: 'percent',
      value: 75,
    });
  });

  it('falls back to fixedWidth', () => {
    expect(resolveMediaDisplaySize({ fixedWidth: 560 })).toEqual({ mode: 'px', px: 560 });
  });

  it('is auto when nothing valid is set', () => {
    expect(resolveMediaDisplaySize({ displayWidth: Number.NaN, fixedWidth: 0 })).toEqual({
      mode: 'auto',
    });
  });
});

describe('sanitize', () => {
  it('clamps percent into 10..100 and rounds', () => {
    expect(sanitizeMediaDisplayWidth(4)).toBe(10);
    expect(sanitizeMediaDisplayWidth(140)).toBe(100);
    expect(sanitizeMediaDisplayWidth(33.6)).toBe(34);
    expect(sanitizeMediaDisplayWidth(undefined)).toBeUndefined();
  });

  it('rejects non-positive px', () => {
    expect(sanitizeMediaFixedPx(-1)).toBeUndefined();
    expect(sanitizeMediaFixedPx(0)).toBeUndefined();
    expect(sanitizeMediaFixedPx(480.4)).toBe(480);
  });
});

describe('snapMediaDisplayPercent', () => {
  it('snaps within 3 of a preset', () => {
    expect(snapMediaDisplayPercent(48)).toBe(50);
    expect(snapMediaDisplayPercent(78)).toBe(75);
    expect(snapMediaDisplayPercent(60)).toBe(60);
  });
});

describe('mediaDisplayFieldsFromSize', () => {
  it('clears the other tier', () => {
    expect(mediaDisplayFieldsFromSize({ mode: 'percent', value: 50 })).toEqual({
      displayWidth: 50,
      fixedWidth: undefined,
    });
    expect(mediaDisplayFieldsFromSize({ mode: 'px', px: 320 })).toEqual({
      displayWidth: undefined,
      fixedWidth: 320,
    });
    expect(mediaDisplayFieldsFromSize({ mode: 'auto' })).toEqual({
      displayWidth: undefined,
      fixedWidth: undefined,
    });
  });
});

describe('getMediaDisplayStyle', () => {
  it('maps each mode to css width', () => {
    expect(getMediaDisplayStyle({ mode: 'percent', value: 75 })).toEqual({ width: '75%' });
    expect(getMediaDisplayStyle({ mode: 'px', px: 560 })).toEqual({
      maxWidth: '100%',
      width: 'min(560px, 100%)',
    });
    expect(getMediaDisplayStyle({ mode: 'auto' })).toEqual({});
  });
});

describe('mediaDisplaySizeAfterResize', () => {
  it('keeps percent mode as a percent of the container', () => {
    expect(mediaDisplaySizeAfterResize('percent', 360, 720)).toEqual({
      mode: 'percent',
      value: 50,
    });
  });

  it('writes px for px and auto modes', () => {
    expect(mediaDisplaySizeAfterResize('px', 360.4, 720)).toEqual({ mode: 'px', px: 360 });
    expect(mediaDisplaySizeAfterResize('auto', 300, 720)).toEqual({ mode: 'px', px: 300 });
  });
});
