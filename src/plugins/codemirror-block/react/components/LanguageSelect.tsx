'use client';

import { Flexbox, MaterialFileTypeIcon, Select, Text } from '@lobehub/ui';
import { cx } from 'antd-style';
import { type FC, useMemo } from 'react';

import { MODES } from '../../lib/mode';
import { styles } from './style';

export interface LanguageSelectProps {
  /** 语言变更回调 */
  onLanguageChange: (value: string) => void;
  /** 当前选中的语言 */
  selectedLang: string;
}

export const LanguageSelect: FC<LanguageSelectProps> = ({ selectedLang, onLanguageChange }) => {
  // 语言选项，使用 useMemo 优化性能
  const languageOptions = useMemo(
    () =>
      MODES.map((mode) => ({
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
    [],
  );

  return (
    <Flexbox
      align={'center'}
      className={'cm-language-select'}
      gap={4}
      horizontal
      onClick={(e) => e.stopPropagation()}
    >
      <Select
        className={cx(styles.container)}
        filterOption={(input, option) => {
          const lang: string = input.toLowerCase();
          // 支持按值匹配
          if ((option?.value as string)?.toLowerCase().startsWith(lang)) return true;
          // 支持按名称匹配
          if (String(option?.label).toLowerCase().includes(lang)) return true;
          // 支持按扩展名匹配
          if (option?.aliases?.some((ext: string) => ext.toLowerCase().startsWith(lang)))
            return true;
          return false;
        }}
        onChange={onLanguageChange}
        options={languageOptions}
        placeholder="选择语言"
        showSearch
        size="small"
        value={selectedLang}
        variant={'borderless'}
      />
    </Flexbox>
  );
};

LanguageSelect.displayName = 'LanguageSelect';
