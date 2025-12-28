'use client';

import { ActionIcon, Flexbox } from '@lobehub/ui';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { type FC } from 'react';

import CopyButton from './CopyButton';
import { LanguageSelect } from './LanguageSelect';
import { MoreOptions } from './MoreOptions';

export interface ToolbarProps {
  expand?: boolean;
  onClick?: () => void;
  onCopy: () => void;
  onLanguageChange: (value: string) => void;
  onShowLineNumbersChange: (checked: boolean) => void;
  onTabSizeChange: (value: number | null) => void;
  onUseTabsChange: (checked: boolean) => void;
  selectedLang: string;
  showLineNumbers: boolean;
  tabSize: number;
  toggleExpand?: () => void;
  useTabs: boolean;
}

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
      <LanguageSelect onLanguageChange={onLanguageChange} selectedLang={selectedLang} />
      <Flexbox gap={4} horizontal onClick={(e) => e.stopPropagation()}>
        <MoreOptions
          onShowLineNumbersChange={onShowLineNumbersChange}
          onTabSizeChange={onTabSizeChange}
          onUseTabsChange={onUseTabsChange}
          showLineNumbers={showLineNumbers}
          tabSize={tabSize}
          useTabs={useTabs}
        />
        <CopyButton onCopy={onCopy} />
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
