import { Image as AntdImage } from 'antd';
import type { CSSProperties, ReactNode } from 'react';

import { getBlockImageClassName, getImageClassName } from '../style';

export function renderImage(node: Record<string, any>, key: string): ReactNode {
  const { src, altText, width, height, maxWidth } = node;
  const style: CSSProperties = {};
  if (maxWidth) style.maxWidth = maxWidth;
  if (width && width !== 'inherit') style.width = width;
  if (height && height !== 'inherit') style.height = height;

  return (
    <span className={getImageClassName()} key={key}>
      <AntdImage
        alt={altText || ''}
        preview={{}}
        src={src}
        styles={{ image: { ...style, cursor: 'zoom-in' } }}
      />
    </span>
  );
}

export function renderBlockImage(node: Record<string, any>, key: string): ReactNode {
  const { src, altText, width, height, maxWidth } = node;
  const style: CSSProperties = {};
  if (maxWidth) style.maxWidth = maxWidth;
  if (width && width !== 'inherit') style.width = width;
  if (height && height !== 'inherit') style.height = height;

  return (
    <figure className={getBlockImageClassName()} key={key}>
      <AntdImage
        alt={altText || ''}
        preview={{}}
        src={src}
        styles={{ image: { ...style, cursor: 'zoom-in' } }}
      />
    </figure>
  );
}
