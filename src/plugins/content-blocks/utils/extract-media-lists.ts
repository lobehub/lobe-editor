import type { ContentBlock, FileListItem, ImageListItem, MediaLists } from '../types';

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

export const extractMediaLists = (blocks: ContentBlock[]): MediaLists => {
  const imageList: ImageListItem[] = [];
  const fileList: FileListItem[] = [];

  for (const block of blocks) {
    if (block.type === 'image') {
      imageList.push({ alt: block.alt, id: generateId(), url: block.url });
    } else if (block.type === 'file') {
      fileList.push({
        fileType: inferFileType(block.name),
        id: generateId(),
        name: block.name,
        size: typeof block.size === 'number' ? block.size : 0,
        url: block.url,
      });
    }
  }

  return { fileList, imageList };
};
