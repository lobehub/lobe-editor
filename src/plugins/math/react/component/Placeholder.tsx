import { Text } from '@lobehub/ui';
import { memo } from 'react';

import { useTranslation } from '@/editor-kernel/react/useTranslation';

const Placeholder = memo(() => {
  const t = useTranslation();
  return (
    <Text
      as={'span'}
      className={'katex'}
      fontSize={'1em'}
      style={{
        fontStyle: 'italic',
        paddingInline: '0.2em',
      }}
      type={'secondary'}
    >
      {t('math.placeholder')}
    </Text>
  );
});

export default Placeholder;
