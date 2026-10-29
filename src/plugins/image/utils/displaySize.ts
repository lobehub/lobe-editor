import { type MediaDisplaySize, resolveMediaDisplaySize } from '@/utils/mediaDisplaySize';

export interface ImageDisplaySource {
  displayWidth?: unknown;
  width?: unknown;
}

export function getImageDisplaySize(node: ImageDisplaySource): MediaDisplaySize {
  return resolveMediaDisplaySize({
    displayWidth: typeof node.displayWidth === 'number' ? node.displayWidth : undefined,
    fixedWidth: typeof node.width === 'number' ? node.width : undefined,
  });
}
