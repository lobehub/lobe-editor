import type {
  CSSProperties,
  CompositionEvent,
  FocusEvent,
  MouseEvent,
  ReactElement,
  ReactNode,
} from 'react';

import type { CommonPluginOptions } from '@/plugins/common';
import type { IEditor } from '@/types';

export interface ReactEditorContentProps {
  content: any;
  lineEmptyPlaceholder?: string;
  placeholder?: ReactNode;
  type: string;
}

export interface ReactPlainTextProps {
  autoFocus?: boolean;
  children: ReactElement<ReactEditorContentProps>;
  className?: string;
  editable?: boolean;
  enableHotkey?: boolean;
  /**
   * Enable automatic markdown formatting for pasted content
   * @default true
   */
  enablePasteMarkdown?: boolean;
  /**
   * Enable/disable markdown shortcuts
   * @default true - all formats enabled
   */
  markdownOption?: CommonPluginOptions['markdownOption'];
  onBlur?: (props: { editor: IEditor; event: FocusEvent<HTMLDivElement> }) => void;
  onChange?: (editor: IEditor) => void;
  onCompositionEnd?: (props: { editor: IEditor; event: CompositionEvent<HTMLDivElement> }) => void;
  onCompositionStart?: (props: {
    editor: IEditor;
    event: CompositionEvent<HTMLDivElement>;
  }) => void;
  onContextMenu?: (props: { editor: IEditor; event: MouseEvent<HTMLDivElement> }) => void;
  onFocus?: (props: { editor: IEditor; event: FocusEvent<HTMLDivElement> }) => void;
  onKeyDown?: (props: { editor: IEditor; event: KeyboardEvent }) => boolean | void;
  onPressEnter?: (props: { editor: IEditor; event: KeyboardEvent }) => boolean | void;
  /**
   * Callback triggered only when text content changes
   * Unlike onChange, this won't trigger on cursor movement or selection changes
   */
  onTextChange?: (editor: IEditor) => void;
  style?: CSSProperties;
  theme?: CommonPluginOptions['theme'] & {
    fontSize?: number;
    headerMultiple?: number;
    lineHeight?: number;
    marginMultiple?: number;
  };
  variant?: 'default' | 'chat';
}
