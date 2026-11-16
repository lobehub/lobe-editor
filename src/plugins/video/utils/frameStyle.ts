import type { CSSProperties } from 'react';

import {
  getMediaDisplayStyle,
  type MediaDisplaySize,
  sanitizeMediaFixedPx,
} from '@/utils/mediaDisplaySize';

export function getVideoFrameStyle(
  size: MediaDisplaySize,
  intrinsicWidth: number | undefined,
): CSSProperties {
  if (size.mode !== 'auto') return getMediaDisplayStyle(size);
  const width = sanitizeMediaFixedPx(intrinsicWidth);
  return width ? { width: `min(${width}px, 100%)` } : {};
}
