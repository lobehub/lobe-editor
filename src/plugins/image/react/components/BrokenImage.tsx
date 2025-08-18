import { memo } from 'react';

import { useTranslation } from '@/editor-kernel/react/useTranslation';

import { imageBroken } from '../style';

const BrokenImage = memo(() => {
  const t = useTranslation();

  return (
    <img
      alt={t('image.broken')}
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
