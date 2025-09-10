import { Text } from '@lobehub/ui';
import { memo } from 'react';
import { Center } from 'react-layout-kit';

import { useTranslation } from '@/editor-kernel/react/useTranslation';

const Placeholder = memo<{ mathBlock?: boolean }>(({ mathBlock }) => {
  const t = useTranslation();

  const node = (
    <Text
      as={'span'}
      className={'katex'}
      fontSize={mathBlock ? '1.2em' : '1em'}
      style={{
        fontStyle: 'italic',
        paddingInline: '0.2em',
      }}
      type={'secondary'}
    >
      {t('math.placeholder')}
    </Text>
  );

  if (!mathBlock) return node;

  return (
    <Center padding={18} width={'100%'}>
      {node}
    </Center>
  );
});

export default Placeholder;
