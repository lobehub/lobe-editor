import { sanitizeMediaFixedPx } from '@/utils/mediaDisplaySize';

type SerializedCaptionNode = {
  children?: SerializedCaptionNode[];
  text?: unknown;
};

type CaptionEditorLike = {
  getEditorState: () => { toJSON: () => { root?: SerializedCaptionNode } };
};

function collectCaptionText(node: SerializedCaptionNode | undefined): string {
  if (!node) return '';
  if (typeof node.text === 'string') return node.text;
  if (!Array.isArray(node.children)) return '';
  return node.children.map((child) => collectCaptionText(child)).join('');
}

function collectRootText(root: SerializedCaptionNode | undefined): string {
  if (!root || !Array.isArray(root.children)) return '';
  return root.children
    .map((block) => collectCaptionText(block))
    .filter(Boolean)
    .join(' ');
}

function isCaptionEditorLike(value: object): value is CaptionEditorLike {
  return typeof (value as CaptionEditorLike).getEditorState === 'function';
}

export function normalizeImageCaption(value: unknown): string {
  if (typeof value === 'string') return value;
  if (!value || typeof value !== 'object') return '';
  if (isCaptionEditorLike(value)) {
    return collectRootText(value.getEditorState().toJSON().root).trim();
  }
  const editorState = (value as { editorState?: { root?: SerializedCaptionNode } }).editorState;
  return collectRootText(editorState?.root).trim();
}

export function sanitizeImageAccent(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  if (/^#[\da-f]{3,8}$/i.test(trimmed)) return trimmed;
  if (/^(?:rgb|hsl)a?\([\d\s%,./a-z-]+\)$/i.test(trimmed)) return trimmed;
  if (/^[a-z]{3,20}$/i.test(trimmed)) return trimmed;
  return undefined;
}

export function sanitizeImageThumbhash(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return /^[\w+/=-]+$/.test(trimmed) ? trimmed : undefined;
}

export interface ImageNaturalSize {
  naturalHeight: number;
  naturalWidth: number;
}

export function sanitizeImageNaturalSize(
  width: unknown,
  height: unknown,
): ImageNaturalSize | undefined {
  const naturalWidth = sanitizeMediaFixedPx(width);
  const naturalHeight = sanitizeMediaFixedPx(height);
  if (naturalWidth === undefined || naturalHeight === undefined) return undefined;
  return { naturalHeight, naturalWidth };
}
