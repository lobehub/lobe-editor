import { describe, expect, it } from 'vitest';

import {
  decodeThumbhash,
  getImagePlaceholderAspectRatio,
  getImagePlaceholderStyle,
} from '../utils/thumbhash';

const THUMBHASH = '1QcSHQRnh493V4dIh4eXh1h4kJUI';

describe('thumbhash placeholder', () => {
  it('decodes a base64 thumbhash into a data URL', () => {
    const placeholder = decodeThumbhash(THUMBHASH);
    expect(placeholder?.dataURL.startsWith('data:image/png;base64,')).toBe(true);
    expect(placeholder?.aspectRatio).toBeGreaterThan(0);
  });

  it('returns null for invalid input', () => {
    expect(decodeThumbhash('***')).toBeNull();
    expect(decodeThumbhash()).toBeNull();
  });

  it('prefers the thumbhash image and keeps accent as background color', () => {
    const style = getImagePlaceholderStyle({ accent: '#123456', thumbhash: THUMBHASH });
    expect(style?.backgroundColor).toBe('#123456');
    expect(style?.backgroundImage).toMatch(/^url\("data:image\/png/);
  });

  it('falls back to the accent color alone', () => {
    expect(getImagePlaceholderStyle({ accent: '#123456' })).toEqual({
      backgroundColor: '#123456',
    });
    expect(getImagePlaceholderStyle({})).toBeUndefined();
  });

  it('uses known dimensions before the thumbhash ratio', () => {
    expect(getImagePlaceholderAspectRatio({ height: 100, width: 200 })).toBe(2);
    expect(getImagePlaceholderAspectRatio({ accent: '#000' })).toBeCloseTo(16 / 9);
  });
});
