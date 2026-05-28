export interface CodeMirrorMode {
  ext?: string[];
  name: string;
  syntax: string;
  value: string;
}

export interface CodeMirrorLabels {
  copy?: string;
  selectLanguage?: string;
  showLineNumbers?: string;
  tabSize?: string;
  useTabs?: string;
}

export interface CopyButtonProps {
  className?: string;
  labels?: Pick<CodeMirrorLabels, 'copy'>;
  onCopy: () => void;
}

export interface LanguageSelectProps {
  className?: string;
  labels?: Pick<CodeMirrorLabels, 'selectLanguage'>;
  onLanguageChange: (value: string) => void;
  options?: CodeMirrorMode[];
  selectedLang: string;
}

export interface MoreOptionsProps {
  labels?: Pick<CodeMirrorLabels, 'showLineNumbers' | 'tabSize' | 'useTabs'>;
  onShowLineNumbersChange: (checked: boolean) => void;
  onTabSizeChange: (value: number | null) => void;
  onUseTabsChange: (checked: boolean) => void;
  showLineNumbers: boolean;
  tabSize: number;
  useTabs: boolean;
}

export interface ToolbarProps {
  expand?: boolean;
  labels?: CodeMirrorLabels;
  languageOptions?: CodeMirrorMode[];
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
