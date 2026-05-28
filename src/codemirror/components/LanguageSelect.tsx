'use client';

import { Flexbox, MaterialFileTypeIcon, Select, Text } from '@lobehub/ui';
import { cx } from 'antd-style';
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
        aliases: mode.ext || [],
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
        title: mode.ext?.length ? mode.ext.map((ext) => `*.${ext}`).join(',') : `*.${mode.value}`,
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
        filterOption={(input, option) => {
          const lang: string = input.toLowerCase();
          if ((option?.value as string)?.toLowerCase().startsWith(lang)) return true;
          if (String(option?.label).toLowerCase().includes(lang)) return true;
          if (option?.aliases?.some((ext: string) => ext.toLowerCase().startsWith(lang)))
            return true;
          return false;
        }}
        onChange={onLanguageChange}
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
