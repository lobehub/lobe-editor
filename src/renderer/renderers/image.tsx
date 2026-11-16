'use client';

import { useImagePreview } from '@lobehub/ui';
import {
  type CSSProperties,
  type FC,
  type ReactNode,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';

import { styles as imageComponentStyles } from '@/plugins/image/react/components/style';
import { imageBroken } from '@/plugins/image/react/style';
import { getImageDisplaySize } from '@/plugins/image/utils/displaySize';
import { normalizeImageCaption, sanitizeImageNaturalSize } from '@/plugins/image/utils/meta';
import { decodeThumbhash, getImagePlaceholderStyle } from '@/plugins/image/utils/thumbhash';
import { getMediaDisplayStyle, type MediaDisplaySize } from '@/utils/mediaDisplaySize';

import { getBlockImageClassName, getImageClassName } from '../style';

type LoadState = 'loading' | 'loaded' | 'error';

const BROKEN_BACKGROUND: CSSProperties = {
  backgroundImage: `url("${imageBroken}")`,
  backgroundPosition: 'center',
  backgroundSize: 'cover',
};

function getImageStyle(node: Record<string, any>): CSSProperties {
  const display = getImageDisplaySize(node);
  if (display.mode === 'percent') return getMediaDisplayStyle(display);
  const { width, height, maxWidth } = node;
  const style: CSSProperties = {};
  // Keep the persisted width, but never let it exceed the container (mobile/share view).
  if (maxWidth) style.maxWidth = `min(${maxWidth}px, 100%)`;
  if (width && width !== 'inherit') style.width = width;
  if (height && height !== 'inherit') style.height = height;
  return style;
}

function getReservedAspectRatio(node: Record<string, any>): string | number | undefined {
  const size =
    sanitizeImageNaturalSize(node.naturalWidth, node.naturalHeight) ??
    sanitizeImageNaturalSize(node.width, node.height);
  if (size) return `${size.naturalWidth} / ${size.naturalHeight}`;
  return decodeThumbhash(node.thumbhash)?.aspectRatio;
}

function getFrameWidth(
  node: Record<string, any>,
  display: MediaDisplaySize,
  state: LoadState,
): string | undefined {
  if (display.mode === 'percent') return `${display.value}%`;
  if (display.mode === 'px') return `min(${display.px}px, 100%)`;
  const natural = sanitizeImageNaturalSize(node.naturalWidth, node.naturalHeight);
  if (natural) {
    const width =
      node.maxWidth > 0 ? Math.min(node.maxWidth, natural.naturalWidth) : natural.naturalWidth;
    return `min(${width}px, 100%)`;
  }
  return state === 'loaded' ? undefined : `min(${node.maxWidth || 800}px, 100%)`;
}

interface RenderedImageProps {
  node: Record<string, any>;
  title?: string;
}

const RenderedImage: FC<RenderedImageProps> = ({ node, title }) => {
  const imageRef = useRef<HTMLImageElement>(null);
  const { open, outlet } = useImagePreview(imageRef);
  const [state, setState] = useState<LoadState>('loading');
  const placeholder = getImagePlaceholderStyle(node);
  const aspectRatio = getReservedAspectRatio(node);
  const framed = !!placeholder || aspectRatio !== undefined;

  useLayoutEffect(() => {
    const image = imageRef.current;
    if (!image?.complete) {
      setState('loading');
      return;
    }
    setState(image.naturalWidth > 0 ? 'loaded' : 'error');
  }, [node.src]);

  const handleLoad = () => setState('loaded');
  const handleError = () => setState('error');

  if (!framed) {
    return (
      <>
        <img
          alt={node.altText || ''}
          className={imageComponentStyles.readonly}
          onClick={open}
          ref={imageRef}
          src={node.src}
          style={getImageStyle(node)}
          title={title}
        />
        {outlet}
      </>
    );
  }

  const frameWidth = getFrameWidth(node, getImageDisplaySize(node), state);

  return (
    <>
      <span
        className={imageComponentStyles.placeholderFrame}
        data-image-placeholder={placeholder && state === 'loading' ? '' : undefined}
        data-image-state={state}
        style={{
          ...(state === 'loaded' ? undefined : placeholder),
          ...(state === 'error' ? BROKEN_BACKGROUND : undefined),
          width: frameWidth,
          aspectRatio: state === 'loaded' ? undefined : aspectRatio,
        }}
      >
        <img
          alt={node.altText || ''}
          className={imageComponentStyles.readonly}
          onClick={open}
          onError={handleError}
          onLoad={handleLoad}
          ref={imageRef}
          src={node.src}
          style={{
            display: state === 'error' ? 'none' : 'block',
            maxWidth: frameWidth ? '100%' : `min(${node.maxWidth || 800}px, 100%)`,
            width: frameWidth ? '100%' : undefined,
            ...(placeholder && {
              opacity: state === 'loaded' ? 1 : 0,
              transition: 'opacity 0.3s ease-out',
            }),
          }}
          title={title}
        />
      </span>
      {outlet}
    </>
  );
};

RenderedImage.displayName = 'RenderedImage';

export function renderImage(node: Record<string, any>, key: string): ReactNode {
  const caption = normalizeImageCaption(node.caption);
  return (
    <span className={getImageClassName()} key={key}>
      <RenderedImage node={node} title={caption || undefined} />
    </span>
  );
}

export function renderBlockImage(node: Record<string, any>, key: string): ReactNode {
  const caption = normalizeImageCaption(node.caption);
  return (
    <figure className={getBlockImageClassName()} key={key}>
      <RenderedImage node={node} />
      {caption && <figcaption className={imageComponentStyles.caption}>{caption}</figcaption>}
    </figure>
  );
}
