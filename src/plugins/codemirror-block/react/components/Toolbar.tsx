'use client';

import { ActionIcon, Flexbox } from '@lobehub/ui';
import { ChevronDown, ChevronRight, Copy } from 'lucide-react';
import { type FC } from 'react';

import { LanguageSelect } from './LanguageSelect';
import { MoreOptions } from './MoreOptions';

export interface ToolbarProps {
  expand?: boolean;
  onClick?: () => void;
  onCopy: () => void;
  onLanguageChange: (value: string) => void;
  onShowLineNumbersChange: (checked: boolean) => void;
  onTabSizeChange: (value: number | null) => void;
  onThemeChange: (value: string) => void;
  onUseTabsChange: (checked: boolean) => void;
  selectedLang: string;
  selectedTheme: string;
  showLineNumbers: boolean;
  tabSize: number;
  toggleExpand?: () => void;
  useTabs: boolean;
}

export const Toolbar: FC<ToolbarProps> = ({
  selectedLang,
  onLanguageChange,
  selectedTheme,
  onThemeChange,
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
          className={'cm-hidden-actions'}
          onShowLineNumbersChange={onShowLineNumbersChange}
          onTabSizeChange={onTabSizeChange}
          onThemeChange={onThemeChange}
          onUseTabsChange={onUseTabsChange}
          selectedTheme={selectedTheme}
          showLineNumbers={showLineNumbers}
          tabSize={tabSize}
          useTabs={useTabs}
        />
        <ActionIcon className={'cm-hidden-actions'} icon={Copy} onClick={onCopy} size="small" />
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
