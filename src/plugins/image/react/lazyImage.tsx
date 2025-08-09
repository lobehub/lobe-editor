import { JSX, useEffect, useState } from 'react';

import { ImageNode } from '../node/image-node';
import { BrokenImage } from './brokerImage';

const imageCache = new Map<string, Promise<boolean> | boolean>();

function isSVG(src: string): boolean {
  return src.toLowerCase().endsWith('.svg');
}

function useSuspenseImage(src: string) {
  let cached = imageCache.get(src);
  if (typeof cached === 'boolean') {
    return cached;
  } else if (!cached) {
    cached = new Promise<boolean>((resolve) => {
      const img = new Image();
      img.src = src;
      img.addEventListener('load', () => resolve(false));
      img.addEventListener('error', () => resolve(true));
    }).then((hasError) => {
      imageCache.set(src, hasError);
      return hasError;
    });
    imageCache.set(src, cached);
    throw cached;
  }
  throw cached;
}

export function LazyImage({
  className,
  node,
  onError,
}: {
  className?: string | null;
  node: ImageNode;
  onError?: () => void;
}): JSX.Element {
  const { src, altText, maxWidth, width } = node;
  const [dimensions, setDimensions] = useState<{
    height: number;
    width: number;
  } | null>(null);
  const isSVGImage = isSVG(src);

  // Set initial dimensions for SVG images
  // useEffect(() => {
  //     if (imageRef.current && isSVGImage) {
  //         const { naturalWidth, naturalHeight } = imageRef.current;
  //         setDimensions({
  //             height: naturalHeight,
  //             width: naturalWidth,
  //         });
  //     }
  // }, [imageRef, isSVGImage]);

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
        if (isSVGImage) {
          const img = e.currentTarget;
          setDimensions({
            height: img.naturalHeight,
            width: img.naturalWidth,
          });
        }
      }}
      src={src}
      style={{ ...imageStyle, cursor: 'default' }}
    />
  );
}
