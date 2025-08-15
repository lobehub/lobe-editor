'use client';

import { Select } from '@lobehub/ui';
import { memo, useMemo } from 'react';
import { bundledLanguagesInfo } from 'shiki';

import { useStyles } from './style';
import type { CodeLanguageSelectProps } from './type';

const CodeLanguageSelect = memo<CodeLanguageSelectProps>(({ className, ...rest }) => {
  const { cx, styles } = useStyles();

  const options = useMemo(
    () => [
      {
        label: 'plaintext',
        value: 'plaintext',
      },
      ...bundledLanguagesInfo.map((item) => ({
        label: item.id,
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
});

CodeLanguageSelect.displayName = 'CodeLanguageSelect';

export default CodeLanguageSelect;
