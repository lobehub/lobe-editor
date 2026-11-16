import type { FC } from 'react';

import type { BlockImageNode } from '../../node/block-image-node';
import type { ImageNode } from '../../node/image-node';
import { getImagePlaceholderAspectRatio, getImagePlaceholderStyle } from '../../utils/thumbhash';
import { styles } from './style';

interface ImagePlaceholderProps {
  newWidth?: number | null;
  node: ImageNode | BlockImageNode;
}

const ImagePlaceholder: FC<ImagePlaceholderProps> = ({ node, newWidth }) => {
  const source = {
    accent: node.accent,
    height: node.height,
    thumbhash: node.thumbhash,
    width: node.width,
  };
  const background = getImagePlaceholderStyle(source);
  if (!background) return null;

  const width = newWidth || (typeof node.width === 'number' && node.width) || node.maxWidth;

  return (
    <span
      aria-hidden
      className={styles.placeholder}
      data-image-placeholder=""
      style={{
        ...background,
        aspectRatio: getImagePlaceholderAspectRatio(source),
        width: `min(${width}px, 100%)`,
      }}
    />
  );
};

ImagePlaceholder.displayName = 'ImagePlaceholder';

export default ImagePlaceholder;
