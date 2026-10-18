import type { CSSProperties, ReactNode } from 'react';

import { getBlockImageClassName, getImageClassName } from '../style';

export function renderImage(node: Record<string, any>, key: string): ReactNode {
  const { src, altText, width, height, maxWidth } = node;
  const style: CSSProperties = {};
  // Keep the persisted width, but never let it exceed the container (mobile/share view).
  if (maxWidth) style.maxWidth = `min(${maxWidth}px, 100%)`;
  if (width && width !== 'inherit') style.width = width;
  if (height && height !== 'inherit') style.height = height;

  return (
    <span className={getImageClassName()} key={key}>
      <img alt={altText || ''} src={src} style={style} />
    </span>
  );
}

export function renderBlockImage(node: Record<string, any>, key: string): ReactNode {
  const { src, altText, width, height, maxWidth } = node;
  const style: CSSProperties = {};
  // Keep the persisted width, but never let it exceed the container (mobile/share view).
  if (maxWidth) style.maxWidth = `min(${maxWidth}px, 100%)`;
  if (width && width !== 'inherit') style.width = width;
  if (height && height !== 'inherit') style.height = height;

  return (
    <figure className={getBlockImageClassName()} key={key}>
      <img alt={altText || ''} src={src} style={style} />
    </figure>
  );
}
