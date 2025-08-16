import { memo } from 'react';

import { useI18n } from '@/editor-kernel/react/useI18n';

import { imageBroken } from '../style';

const BrokenImage = memo(() => {
  const __ = useI18n();

  return (
    <img
      alt={__('image.broken')}
      draggable="false"
      src={imageBroken}
      style={{
        height: 'auto',
        width: 200,
      }}
    />
  );
});

BrokenImage.displayName = 'BrokenImage';

export default BrokenImage;
