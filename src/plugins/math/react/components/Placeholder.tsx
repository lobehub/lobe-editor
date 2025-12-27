import { Center, Text } from '@lobehub/ui';
import { cx } from 'antd-style';
import { type FC } from 'react';

import { useTranslation } from '@/editor-kernel/react/useTranslation';

import { styles } from '../style';

interface PlaceholderProps {
  mathBlock?: boolean;
}

const Placeholder: FC<PlaceholderProps> = ({ mathBlock }) => {
  const t = useTranslation();

  const node = (
    <Text
      as={'span'}
      className={cx('katex', styles.mathPlaceholder)}
      fontSize={mathBlock ? '1.2em' : '1em'}
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
