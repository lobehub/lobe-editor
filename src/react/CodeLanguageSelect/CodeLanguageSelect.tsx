'use client';

import { Flexbox, MaterialFileTypeIcon } from '@lobehub/ui';
import { Select, Text } from '@lobehub/ui/base-ui';
import { cx } from 'antd-style';
import { type FC, useMemo } from 'react';
import { bundledLanguagesInfo } from 'shiki';

import { styles } from './style';
import type { CodeLanguageSelectProps } from './type';

const CodeLanguageSelect: FC<CodeLanguageSelectProps> = ({ className, ...rest }) => {
  const options = useMemo(
    () => [
      {
        label: (
          <Flexbox align={'center'} gap={4} horizontal>
            <MaterialFileTypeIcon
              fallbackUnknownType={false}
              filename={`*.txt`}
              size={18}
              type={'file'}
              variant={'raw'}
            />
            <Text ellipsis fontSize={13}>
              Plaintext
            </Text>
          </Flexbox>
        ),
        title: 'plaintext text txt',
        value: 'plaintext',
      },
      ...bundledLanguagesInfo.map((item) => ({
        label: (
          <Flexbox align={'center'} gap={4} horizontal>
            <MaterialFileTypeIcon
              fallbackUnknownType={false}
              filename={`*.${item?.aliases?.[0] || item.id}`}
              size={18}
              type={'file'}
              variant={'raw'}
            />
            <Text ellipsis fontSize={13}>
              {item.name}
            </Text>
          </Flexbox>
        ),
        title: [item.id, ...(item.aliases || [])].join(' '),
        value: item.id,
      })),
    ],
    [],
  );

  return (
    <Select
      className={cx(styles.container, className)}
      defaultValue={'plaintext'}
      options={options}
      showSearch
      variant={'filled'}
      {...rest}
    />
  );
};

CodeLanguageSelect.displayName = 'CodeLanguageSelect';

export default CodeLanguageSelect;
