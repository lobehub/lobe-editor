'use client';

import { MaterialFileTypeIcon, Select, Text , Flexbox } from '@lobehub/ui';
import { memo, useMemo } from 'react';
import { bundledLanguagesInfo } from 'shiki';

import { useStyles } from './style';
import type { CodeLanguageSelectProps } from './type';

// Keep memo: UseMemo calculation of large language options array (100+ items from bundledLanguagesInfo)
const CodeLanguageSelect = memo<CodeLanguageSelectProps>(({ className, ...rest }) => {
  const { cx, styles } = useStyles();

  const options = useMemo(
    () => [
      {
        aliases: ['text', 'txt'],
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
        value: 'plaintext',
      },
      ...bundledLanguagesInfo.map((item) => ({
        aliases: item.aliases,
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
        title: (item.aliases || [item.id])
          .filter(Boolean)
          .map((item) => `*.${item}`)
          .join(','),
        value: item.id,
      })),
    ],
    [],
  );

  return (
    <Select
      className={cx(styles.container, className)}
      defaultValue={'plaintext'}
      filterOption={(input, option) => {
        const lang: string = input.toLowerCase();
        if ((option?.value as string)?.startsWith(lang)) return true;
        if (option?.aliases?.some((item: string) => item.startsWith(lang))) return true;
        return false;
      }}
      options={options}
      showSearch
      variant={'filled'}
      {...rest}
    />
  );
});

CodeLanguageSelect.displayName = 'CodeLanguageSelect';

export default CodeLanguageSelect;
