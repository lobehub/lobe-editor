import { type FC } from 'react';

import { useTranslation } from '@/editor-kernel/react/useTranslation';

import { imageBroken } from '../style';
import { styles } from './style';

const BrokenImage: FC = () => {
  const t = useTranslation();

  return (
    <img
      alt={t('image.broken')}
      className={styles.brokenImage}
      draggable="false"
      src={imageBroken}
    />
  );
};

BrokenImage.displayName = 'BrokenImage';

export default BrokenImage;
