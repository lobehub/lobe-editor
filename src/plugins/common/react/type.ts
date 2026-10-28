import type {
  CompositionEvent,
  CSSProperties,
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
  /**
   * Automatically convert pasted markdown once the detection threshold is reached
   * @default true
   */
  autoFormatMarkdown?: boolean;
  children: ReactElement<ReactEditorContentProps>;
  className?: string;
  editable?: boolean;
  /**
   * Give headings a unique DOM `id` slug and show a hover "copy link" action
   * @default true (false when `variant` is `'chat'`)
   */
  enableHeadingAnchor?: boolean;
  /**
   * Show a hover toggle that folds the content under a heading (view state only, never serialized)
   * @default true (false when `variant` is `'chat'`)
   */
  enableHeadingFold?: boolean;
  enableHotkey?: boolean;
  /**
   * Enable automatic markdown conversion for pasted content
   * @default true
   */
  enablePasteMarkdown?: boolean;
  /**
   * Enable/disable markdown shortcuts
   * @default true - all formats enabled
   */
  /**
   * Build the link copied by the heading "copy link" action
   * @default current URL with `#slug`
   */
  getHeadingLink?: (slug: string) => string;
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
  /**
   * Force paste as plain text, stripping all rich text formatting
   * @default false
   */
  pasteAsPlainText?: boolean;
  /**
   * Minimum markdown score required before auto conversion runs
   * @default 5
   */
  pasteMarkdownAutoConvertThreshold?: number;
  /**
   * When pasting VS Code content (detected via vscode-editor-data clipboard type),
   * create a code block with the language from VS Code instead of pasting as plain text.
   * This option only takes effect when pasteAsPlainText is enabled.
   * @default true
   */
  pasteVSCodeAsCodeBlock?: boolean;
  style?: CSSProperties;
  theme?: CommonPluginOptions['theme'] & {
    fontSize?: number;
    headerMultiple?: number;
    lineHeight?: number;
    marginMultiple?: number;
  };
  variant?: 'default' | 'chat';
}
