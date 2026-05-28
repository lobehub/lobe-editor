'use client';

import { ActionIcon, Flexbox } from '@lobehub/ui';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { type FC } from 'react';

import type { ToolbarProps } from '../types';
import { CopyButton } from './CopyButton';
import { LanguageSelect } from './LanguageSelect';
import { MoreOptions } from './MoreOptions';

export const Toolbar: FC<ToolbarProps> = ({
  selectedLang,
  onLanguageChange,
  onCopy,
  tabSize,
  onTabSizeChange,
  useTabs,
  onUseTabsChange,
  showLineNumbers,
  onShowLineNumbersChange,
  onClick,
  expand,
  toggleExpand,
  labels,
  languageOptions,
}) => {
  return (
    <Flexbox
      align={'center'}
      className={'cm-header-toolbar'}
      horizontal
      justify={'space-between'}
      onClick={onClick}
      padding={4}
    >
      <LanguageSelect
        labels={labels}
        onLanguageChange={onLanguageChange}
        options={languageOptions}
        selectedLang={selectedLang}
      />
      <Flexbox gap={4} horizontal onClick={(e) => e.stopPropagation()}>
        <MoreOptions
          labels={labels}
          onShowLineNumbersChange={onShowLineNumbersChange}
          onTabSizeChange={onTabSizeChange}
          onUseTabsChange={onUseTabsChange}
          showLineNumbers={showLineNumbers}
          tabSize={tabSize}
          useTabs={useTabs}
        />
        <CopyButton labels={labels} onCopy={onCopy} />
        <ActionIcon
          icon={expand ? ChevronDown : ChevronRight}
          onClick={toggleExpand}
          size="small"
        />
      </Flexbox>
    </Flexbox>
  );
};

Toolbar.displayName = 'Toolbar';
