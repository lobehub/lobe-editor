import { sanitizeMediaDisplayWidth, sanitizeMediaFixedPx } from '@/utils/mediaDisplaySize';

const ENTITY_MAP: Record<string, string> = {
  '&#39;': "'",
  '&amp;': '&',
  '&gt;': '>',
  '&lt;': '<',
  '&quot;': '"',
};

export function decodeHtmlEntities(value: string): string {
  return value.replaceAll(/&(?:quot|amp|lt|gt|#39);/g, (entity) => ENTITY_MAP[entity] ?? entity);
}

export function escapeHtmlAttribute(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('"', '&quot;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
}

export function parseHtmlTagAttributes(tag: string): Record<string, string> {
  const body = tag.replace(/^<\s*[\w-]+/, '').replace(/\/?\s*>$/, '');
  const attributes: Record<string, string> = {};
  for (const match of body.matchAll(
    /([^\s"'/=>]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=>]+)))?/g,
  )) {
    const name = match[1].toLowerCase();
    attributes[name] = decodeHtmlEntities(match[2] ?? match[3] ?? match[4] ?? '');
  }
  return attributes;
}

export function isSafeVideoSrc(src: string | null | undefined): src is string {
  if (!src) return false;
  const trimmed = src.trim();
  if (!trimmed) return false;
  if (/^(?:javascript|vbscript):/i.test(trimmed)) return false;
  if (/^data:/i.test(trimmed)) return /^data:video\//i.test(trimmed);
  return true;
}

export interface VideoSizeAttributes {
  displayWidth?: number;
  fixedWidth?: number;
}

export function readVideoSizeAttributes(
  style: string | null | undefined,
  width: string | null | undefined,
): VideoSizeAttributes {
  const styleWidth = style?.match(/(?:^|;)\s*width\s*:\s*([\d.]+)\s*(%|px)?/i);
  if (styleWidth) {
    const value = Number(styleWidth[1]);
    if (styleWidth[2] === '%') return { displayWidth: sanitizeMediaDisplayWidth(value) };
    return { fixedWidth: sanitizeMediaFixedPx(value) };
  }
  if (width && /^\d+(?:\.\d+)?(?:px)?$/i.test(width.trim())) {
    return { fixedWidth: sanitizeMediaFixedPx(Number.parseFloat(width)) };
  }
  return {};
}
