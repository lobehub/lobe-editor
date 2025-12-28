'use client';

import { ActionIcon, Flexbox, InputNumber, Select, Text } from '@lobehub/ui';
import { Popover, Switch } from 'antd';
import { MoreHorizontalIcon } from 'lucide-react';
import { type FC, useCallback } from 'react';

import { useTranslation } from '@/editor-kernel/react/useTranslation';

import { THEMES } from '../../lib/mode';

export interface MoreOptionsProps {
  className?: string;
  /** 行号显示变更回调 */
  onShowLineNumbersChange: (checked: boolean) => void;
  /** Tab 大小变更回调 */
  onTabSizeChange: (value: number | null) => void;
  /** 主题变更回调 */
  onThemeChange: (value: string) => void;
  /** 制表符使用变更回调 */
  onUseTabsChange: (checked: boolean) => void;
  /** 当前选中的主题 */
  selectedTheme: string;
  /** 是否显示行号 */
  showLineNumbers: boolean;
  /** Tab 大小 */
  tabSize: number;
  /** 是否使用制表符 */
  useTabs: boolean;
}

export const MoreOptions: FC<MoreOptionsProps> = ({
  selectedTheme,
  onThemeChange,
  tabSize,
  onTabSizeChange,
  useTabs,
  onUseTabsChange,
  showLineNumbers,
  onShowLineNumbersChange,
  className,
}) => {
  const t = useTranslation();
  // 主题选项
  const themeOptions = THEMES.map((theme) => ({
    label: theme.name,
    value: theme.value,
  }));

  const handleTabSizeChange = useCallback(
    (value: number | null = 2) => {
      const v = value === null ? 2 : value;
      onTabSizeChange(v);
    },
    [onTabSizeChange],
  );

  return (
    <Popover
      arrow={false}
      content={
        <Flexbox gap={8} style={{ minWidth: 240 }}>
          <Flexbox align={'center'} gap={8} horizontal justify={'space-between'}>
            <Text>{t('codemirror.theme')}</Text>
            <Select
              onChange={onThemeChange}
              options={themeOptions}
              placeholder={t('codemirror.selectTheme')}
              size="small"
              style={{ minWidth: '120px' }}
              value={selectedTheme}
            />
          </Flexbox>
          <Flexbox align={'center'} gap={8} horizontal justify={'space-between'}>
            <Text>{t('codemirror.tabSize')}</Text>
            <InputNumber
              max={8}
              min={1}
              onChange={handleTabSizeChange as any}
              size="small"
              value={tabSize}
            />
          </Flexbox>
          <Flexbox align={'center'} gap={8} horizontal justify={'space-between'}>
            <Text>{t('codemirror.useTabs')}</Text>
            <Switch checked={useTabs} onChange={onUseTabsChange} size="small" />
          </Flexbox>
          <Flexbox align={'center'} gap={8} horizontal justify={'space-between'}>
            <Text>{t('codemirror.showLineNumbers')}</Text>
            <Switch checked={showLineNumbers} onChange={onShowLineNumbersChange} size="small" />
          </Flexbox>
        </Flexbox>
      }
      placement="bottomRight"
      trigger="click"
    >
      <ActionIcon className={className} icon={MoreHorizontalIcon} size="small" />
    </Popover>
  );
};

MoreOptions.displayName = 'MoreOptions';
