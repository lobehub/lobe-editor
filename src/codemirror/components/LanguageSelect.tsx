'use client';

import { cx, Flexbox, MaterialFileTypeIcon, Select, Text } from '@lobehub/ui';
import { type FC, useMemo } from 'react';

import { LANGUAGES } from '../constants';
import type { LanguageSelectProps } from '../types';
import { styles } from './style';

export const LanguageSelect: FC<LanguageSelectProps> = ({
  selectedLang,
  onLanguageChange,
  options,
  labels,
  className,
}) => {
  const modes = options ?? LANGUAGES;
  const languageOptions = useMemo(
    () =>
      modes.map((mode) => ({
        label: (
          <Flexbox align={'center'} gap={4} horizontal>
            <MaterialFileTypeIcon
              fallbackUnknownType={false}
              filename={mode.ext?.[0] ? `*.${mode.ext[0]}` : `*.${mode.value}`}
              size={18}
              type={'file'}
              variant={'raw'}
            />
            <Text ellipsis fontSize={13}>
              {mode.name}
            </Text>
          </Flexbox>
        ),
        title: [mode.value, mode.name, ...(mode.ext || [])].join(' '),
        value: mode.value,
      })),
    [modes],
  );

  return (
    <Flexbox
      align={'center'}
      className={cx('cm-language-select', className)}
      gap={4}
      horizontal
      onClick={(e) => e.stopPropagation()}
    >
      <Select
        className={cx(styles.container)}
        onChange={(value) => onLanguageChange(value as string)}
        options={languageOptions}
        placeholder={labels?.selectLanguage ?? 'Select language'}
        showSearch
        size="small"
        value={selectedLang}
        variant={'borderless'}
      />
    </Flexbox>
  );
};

LanguageSelect.displayName = 'LanguageSelect';
