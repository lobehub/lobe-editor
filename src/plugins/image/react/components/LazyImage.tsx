import { memo, useEffect, useState } from 'react';

import { BlockImageNode } from '../../node/block-image-node';
import { ImageNode } from '../../node/image-node';
import BrokenImage from './BrokenImage';
import { useSuspenseImage } from './useSupenseImage';

function isSVG(src: string): boolean {
  return src.toLowerCase().endsWith('.svg');
}

const LazyImage = memo<{
  className?: string | null;
  newWidth?: number | null;
  node: ImageNode | BlockImageNode;
  onError?: () => void;
  // eslint-disable-next-line unused-imports/no-unused-vars
  onLoad?: (dimensions: { height: number; width: number }) => void;
}>(({ className, node, newWidth, onError, onLoad }) => {
  const { src, altText, maxWidth, width } = node;
  const [dimensions, setDimensions] = useState<{
    height: number;
    width: number;
  } | null>(null);
  const isSVGImage = isSVG(src);

  const hasError = useSuspenseImage(src);

  useEffect(() => {
    if (hasError && onError) {
      onError();
    }
  }, [hasError, onError]);

  if (hasError) {
    return <BrokenImage />;
  }

  // Calculate final dimensions with proper scaling
  const calculateDimensions = () => {
    if (!isSVGImage) {
      return {
        maxWidth,
        width,
      };
    }

    // Use natural dimensions if available, otherwise fallback to defaults
    const naturalWidth = dimensions?.width || 200;
    const naturalHeight = dimensions?.height || 200;

    let finalWidth = naturalWidth;
    let finalHeight = naturalHeight;

    // Scale down if width exceeds maxWidth while maintaining aspect ratio
    if (finalWidth > maxWidth) {
      const scale = maxWidth / finalWidth;
      finalWidth = maxWidth;
      finalHeight = Math.round(finalHeight * scale);
    }

    // Scale down if height exceeds maxHeight while maintaining aspect ratio
    const maxHeight = 500;
    if (finalHeight > maxHeight) {
      const scale = maxHeight / finalHeight;
      finalHeight = maxHeight;
      finalWidth = Math.round(finalWidth * scale);
    }

    return {
      maxWidth,
      width: finalWidth,
    };
  };

  const imageStyle = calculateDimensions();

  return (
    <img
      alt={altText}
      className={className || undefined}
      draggable="false"
      onError={onError}
      onLoad={(e) => {
        const img = e.currentTarget;
        const width = Math.min(img.naturalWidth, img.getBoundingClientRect().width);
        if (isSVGImage) {
          setDimensions({
            height: img.naturalHeight,
            width,
          });
        }
        onLoad?.({
          height: img.naturalHeight,
          width,
        });
      }}
      src={src}
      style={{
        ...imageStyle,
        cursor: 'default',
        maxWidth: `calc(min(${newWidth || imageStyle.maxWidth}px, 100%))`,
        width: newWidth || imageStyle.width,
      }}
    />
  );
});

LazyImage.displayName = 'LazyImage';

export default LazyImage;
