import type { SerializedEditorState, SerializedLexicalNode } from 'lexical';

export interface ImageListItem {
  alt: string;
  id: string;
  url: string;
}

export interface FileListItem {
  fileType: string;
  id: string;
  name: string;
  size: number;
  url: string;
}

export interface MediaLists {
  fileList: FileListItem[];
  imageList: ImageListItem[];
}

const IMAGE_TYPES = new Set(['image', 'block-image']);
const FILE_TYPE = 'file';

const generateId = (): string => {
  if (typeof globalThis.crypto?.randomUUID === 'function') {
    return globalThis.crypto.randomUUID();
  }
  return `id-${Math.random().toString(36).slice(2)}-${Date.now().toString(36)}`;
};

const inferFileType = (name: string): string => {
  const dotIndex = name.lastIndexOf('.');
  if (dotIndex < 0 || dotIndex === name.length - 1) return 'unknown';
  return name.slice(dotIndex + 1).toLowerCase() || 'unknown';
};

type AnyNode = SerializedLexicalNode & {
  altText?: unknown;
  children?: unknown;
  fileUrl?: unknown;
  name?: unknown;
  size?: unknown;
  src?: unknown;
  status?: unknown;
};

export const extractMediaFromEditorState = (
  state: SerializedEditorState | null | undefined,
): MediaLists => {
  const imageList: ImageListItem[] = [];
  const fileList: FileListItem[] = [];

  const visit = (node: AnyNode): void => {
    const type = node.type;
    if (IMAGE_TYPES.has(type)) {
      if (node.status === 'uploaded' && typeof node.src === 'string' && node.src) {
        imageList.push({
          alt: typeof node.altText === 'string' ? node.altText : '',
          id: generateId(),
          url: node.src,
        });
      }
      return;
    }
    if (type === FILE_TYPE) {
      if (node.status === 'uploaded' && typeof node.fileUrl === 'string' && node.fileUrl) {
        const name = typeof node.name === 'string' ? node.name : 'unknown';
        fileList.push({
          fileType: inferFileType(name),
          id: generateId(),
          name,
          size: typeof node.size === 'number' ? node.size : 0,
          url: node.fileUrl,
        });
      }
      return;
    }
    if (Array.isArray(node.children)) {
      for (const child of node.children as AnyNode[]) visit(child);
    }
  };

  const root = state?.root as AnyNode | undefined;
  if (root && Array.isArray(root.children)) {
    for (const child of root.children as AnyNode[]) visit(child);
  }

  return { fileList, imageList };
};
