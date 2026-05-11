import { Image as AntdImage } from 'antd';
import { cx } from 'antd-style';
import { type CSSProperties, type FC, useEffect, useState } from 'react';

import { BlockImageNode } from '../../node/block-image-node';
import { ImageNode } from '../../node/image-node';
import BrokenImage from './BrokenImage';
import { styles } from './style';
import { useSuspenseImage } from './useSupenseImage';

function isSVG(src: string): boolean {
  return src.toLowerCase().endsWith('.svg');
}

interface LazyImageProps {
  className?: string | null;
  enableImagePreview?: boolean;
  newWidth?: number | null;
  node: ImageNode | BlockImageNode;
  onError?: () => void;
  // eslint-disable-next-line unused-imports/no-unused-vars
  onLoad?: (dimensions: { height: number; width: number }) => void;
  /** Called when preview overlay opens (e.g. to sync Lexical selection). */
  onPreviewOpen?: () => void;
}

const LazyImage: FC<LazyImageProps> = ({
  className,
  enableImagePreview = true,
  node,
  newWidth,
  onError,
  onLoad,
  onPreviewOpen,
}) => {
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

  const mergedStyle = {
    ...imageStyle,
    maxWidth: `calc(min(${newWidth || imageStyle.maxWidth}px, 100%))`,
    width: newWidth || imageStyle.width,
    ...(enableImagePreview ? { cursor: 'zoom-in' as const } : {}),
  };

  return (
    <AntdImage
      alt={altText}
      classNames={{ image: cx(styles.lazyImage, className || undefined) }}
      draggable={false}
      onError={onError}
      onLoad={(e) => {
        const img = e.currentTarget;
        const w = Math.min(img.naturalWidth, img.getBoundingClientRect().width);
        if (isSVGImage) {
          setDimensions({
            height: img.naturalHeight,
            width: w,
          });
        }
        onLoad?.({
          height: img.naturalHeight,
          width: w,
        });
      }}
      preview={
        enableImagePreview
          ? {
              onOpenChange: (open: boolean) => {
                if (open) {
                  onPreviewOpen?.();
                }
              },
            }
          : false
      }
      src={src}
      styles={{ image: mergedStyle as CSSProperties }}
    />
  );
};

LazyImage.displayName = 'LazyImage';

export default LazyImage;
