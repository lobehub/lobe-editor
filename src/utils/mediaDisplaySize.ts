import type { CSSProperties } from 'react';

export type MediaDisplayMode = 'auto' | 'percent' | 'px';

export type MediaDisplaySize =
  { mode: 'auto' } | { mode: 'percent'; value: number } | { mode: 'px'; px: number };

export interface MediaDisplayFields {
  displayWidth?: number;
  fixedWidth?: number;
}

export const MEDIA_DISPLAY_PRESETS = [25, 50, 75, 100] as const;
export const MEDIA_DISPLAY_MIN = 10;
export const MEDIA_DISPLAY_MAX = 100;
const SNAP_THRESHOLD = 3;

export function sanitizeMediaDisplayWidth(value: unknown): number | undefined {
  if (typeof value !== 'number' || !Number.isFinite(value)) return undefined;
  return Math.round(Math.min(MEDIA_DISPLAY_MAX, Math.max(MEDIA_DISPLAY_MIN, value)));
}

export function sanitizeMediaFixedPx(value: unknown): number | undefined {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) return undefined;
  return Math.round(value);
}

export function snapMediaDisplayPercent(value: number): number {
  for (const preset of MEDIA_DISPLAY_PRESETS) {
    if (Math.abs(value - preset) <= SNAP_THRESHOLD) return preset;
  }
  return value;
}

export function resolveMediaDisplaySize(fields: MediaDisplayFields): MediaDisplaySize {
  const displayWidth = sanitizeMediaDisplayWidth(fields.displayWidth);
  if (displayWidth !== undefined) return { mode: 'percent', value: displayWidth };
  const fixedWidth = sanitizeMediaFixedPx(fields.fixedWidth);
  if (fixedWidth !== undefined) return { mode: 'px', px: fixedWidth };
  return { mode: 'auto' };
}

export function mediaDisplayFieldsFromSize(size: MediaDisplaySize): {
  displayWidth: number | undefined;
  fixedWidth: number | undefined;
} {
  switch (size.mode) {
    case 'percent': {
      return { displayWidth: sanitizeMediaDisplayWidth(size.value), fixedWidth: undefined };
    }
    case 'px': {
      return { displayWidth: undefined, fixedWidth: sanitizeMediaFixedPx(size.px) };
    }
    default: {
      return { displayWidth: undefined, fixedWidth: undefined };
    }
  }
}

export function getMediaDisplayStyle(size: MediaDisplaySize): CSSProperties {
  switch (size.mode) {
    case 'percent': {
      return { width: `${size.value}%` };
    }
    case 'px': {
      return { maxWidth: '100%', width: `min(${size.px}px, 100%)` };
    }
    default: {
      return {};
    }
  }
}

export function mediaDisplaySizeAfterResize(
  mode: MediaDisplayMode,
  widthPx: number,
  containerWidth: number,
): MediaDisplaySize {
  if (mode === 'percent' && containerWidth > 0) {
    const value = sanitizeMediaDisplayWidth((widthPx / containerWidth) * 100);
    if (value !== undefined) return { mode: 'percent', value };
  }
  const px = sanitizeMediaFixedPx(widthPx);
  return px === undefined ? { mode: 'auto' } : { mode: 'px', px };
}
