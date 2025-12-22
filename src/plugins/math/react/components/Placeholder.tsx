import { Text , Center } from '@lobehub/ui';
import { type FC } from 'react';

import { useTranslation } from '@/editor-kernel/react/useTranslation';

interface PlaceholderProps {
  mathBlock?: boolean;
}

const Placeholder: FC<PlaceholderProps> = ({ mathBlock }) => {
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
};

export default Placeholder;
