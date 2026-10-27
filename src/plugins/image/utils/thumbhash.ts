import type { CSSProperties } from 'react';
import { thumbHashToApproximateAspectRatio, thumbHashToDataURL } from 'thumbhash';

export interface ThumbhashPlaceholder {
  aspectRatio: number;
  dataURL: string;
}

const cache = new Map<string, ThumbhashPlaceholder | null>();

function base64ToBytes(value: string): Uint8Array {
  const binary = atob(value.replaceAll('-', '+').replaceAll('_', '/'));
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

export function decodeThumbhash(hash?: string): ThumbhashPlaceholder | null {
  if (!hash) return null;
  const cached = cache.get(hash);
  if (cached !== undefined) return cached;
  let result: ThumbhashPlaceholder | null = null;
  try {
    const bytes = base64ToBytes(hash);
    result = {
      aspectRatio: thumbHashToApproximateAspectRatio(bytes),
      dataURL: thumbHashToDataURL(bytes),
    };
  } catch {
    result = null;
  }
  cache.set(hash, result);
  return result;
}

export interface ImagePlaceholderSource {
  accent?: string;
  height?: number | string;
  thumbhash?: string;
  width?: number | string;
}

export function getImagePlaceholderStyle(
  source: ImagePlaceholderSource,
): CSSProperties | undefined {
  const placeholder = decodeThumbhash(source.thumbhash);
  if (!placeholder && !source.accent) return undefined;
  const style: CSSProperties = {};
  if (source.accent) style.backgroundColor = source.accent;
  if (placeholder) {
    style.backgroundImage = `url("${placeholder.dataURL}")`;
    style.backgroundPosition = 'center';
    style.backgroundSize = 'cover';
  }
  return style;
}

export function getImagePlaceholderAspectRatio(source: ImagePlaceholderSource): number {
  const { width, height } = source;
  if (typeof width === 'number' && typeof height === 'number' && width > 0 && height > 0) {
    return width / height;
  }
  return decodeThumbhash(source.thumbhash)?.aspectRatio || 16 / 9;
}
