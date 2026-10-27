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
import { normalizeImageCaption } from '@/plugins/image/utils/meta';
import {
  getImagePlaceholderAspectRatio,
  getImagePlaceholderStyle,
} from '@/plugins/image/utils/thumbhash';

import { getBlockImageClassName, getImageClassName } from '../style';

function getImageStyle(node: Record<string, any>): CSSProperties {
  const { width, height, maxWidth } = node;
  const style: CSSProperties = {};
  // Keep the persisted width, but never let it exceed the container (mobile/share view).
  if (maxWidth) style.maxWidth = `min(${maxWidth}px, 100%)`;
  if (width && width !== 'inherit') style.width = width;
  if (height && height !== 'inherit') style.height = height;
  return style;
}

interface RenderedImageProps {
  node: Record<string, any>;
  title?: string;
}

const RenderedImage: FC<RenderedImageProps> = ({ node, title }) => {
  const imageRef = useRef<HTMLImageElement>(null);
  const { open, outlet } = useImagePreview(imageRef);
  const [loading, setLoading] = useState(false);
  const placeholder = getImagePlaceholderStyle(node);
  const hasPlaceholder = !!placeholder;
  const imageStyle = getImageStyle(node);

  useLayoutEffect(() => {
    const image = imageRef.current;
    setLoading(hasPlaceholder && !!image && !image.complete);
  }, [node.src, hasPlaceholder]);

  const image = (
    <img
      alt={node.altText || ''}
      className={imageComponentStyles.readonly}
      onClick={open}
      onError={() => setLoading(false)}
      onLoad={() => setLoading(false)}
      ref={imageRef}
      src={node.src}
      style={
        placeholder
          ? {
              ...imageStyle,
              aspectRatio: loading ? getImagePlaceholderAspectRatio(node) : undefined,
              display: 'block',
              opacity: loading ? 0 : 1,
              transition: 'opacity 0.3s ease-out',
              width:
                imageStyle.width ?? (loading ? `min(${node.maxWidth || 800}px, 100%)` : undefined),
            }
          : imageStyle
      }
      title={title}
    />
  );

  return (
    <>
      {placeholder ? (
        <span
          className={imageComponentStyles.placeholderFrame}
          data-image-placeholder={loading ? '' : undefined}
          style={loading ? placeholder : undefined}
        >
          {image}
        </span>
      ) : (
        image
      )}
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
