'use client';

import { ActionIcon, Flexbox, InputNumber, Popover, Text } from '@lobehub/ui';
import { Switch } from 'antd';
import { MoreHorizontalIcon } from 'lucide-react';
import { type FC, useCallback } from 'react';

import type { MoreOptionsProps } from '../types';

export const MoreOptions: FC<MoreOptionsProps> = ({
  tabSize,
  onTabSizeChange,
  useTabs,
  onUseTabsChange,
  showLineNumbers,
  onShowLineNumbersChange,
  labels,
}) => {
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
            <Text>{labels?.tabSize ?? 'Tab size'}</Text>
            <InputNumber
              max={8}
              min={1}
              onChange={handleTabSizeChange as any}
              size="small"
              value={tabSize}
            />
          </Flexbox>
          <Flexbox align={'center'} gap={8} horizontal justify={'space-between'}>
            <Text>{labels?.useTabs ?? 'Use tabs'}</Text>
            <Switch checked={useTabs} onChange={onUseTabsChange} size="small" />
          </Flexbox>
          <Flexbox align={'center'} gap={8} horizontal justify={'space-between'}>
            <Text>{labels?.showLineNumbers ?? 'Show line numbers'}</Text>
            <Switch checked={showLineNumbers} onChange={onShowLineNumbersChange} size="small" />
          </Flexbox>
        </Flexbox>
      }
      placement="bottomRight"
      trigger="click"
    >
      <ActionIcon className={'cm-hidden-actions'} icon={MoreHorizontalIcon} size="small" />
    </Popover>
  );
};

MoreOptions.displayName = 'MoreOptions';
