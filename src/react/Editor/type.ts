import type { CSSProperties, FC, ReactNode } from 'react';

import type { ReactEditorContentProps, ReactPlainTextProps } from '@/plugins/common/react';
import type { ReactMentionPluginProps } from '@/plugins/mention/react';
import type { ReactSlashOptionProps } from '@/plugins/slash/react';
import type { IEditor } from '@/types';

export type EditorPlugin = FC<any> | [FC<any>, Record<string, any>];

interface MentionOption extends Partial<ReactSlashOptionProps> {
  markdownWriter?: ReactMentionPluginProps['markdownWriter'];
}

export interface EditorProps
  extends Partial<ReactEditorContentProps>, Omit<ReactPlainTextProps, 'children'> {
  autoFocus?: boolean;
  /**
   * Automatically convert pasted markdown once the detection threshold is reached
   * @default true
   */
  autoFormatMarkdown?: boolean;
  children?: ReactNode;
  className?: string;
  /**
   * Debounce wait time in milliseconds for onChange and onTextChange callbacks
   * @default 100
   */
  debounceWait?: number;
  editable?: boolean;
  editor?: IEditor;
  /**
   * Enable automatic markdown conversion for pasted content
   * @default true
   */
  enablePasteMarkdown?: boolean;
  /** Custom popup container for slash menu portal rendering and scroll tracking */
  getPopupContainer?: () => HTMLElement | null;
  markdownOption?:
    | boolean
    | {
        bold?: boolean;
        code?: boolean;
        header?: boolean;
        italic?: boolean;
        quote?: boolean;
        strikethrough?: boolean;
        underline?: boolean;
        underlineStrikethrough?: boolean;
      };
  mentionOption?: MentionOption;
  onInit?: (editor: IEditor) => void;
  /**
   * Callback triggered only when text content changes
   * Unlike onChange, this won't trigger on cursor movement or selection changes
   */
  onTextChange?: (editor: IEditor) => void;
  /**
   * Minimum markdown score required before auto conversion runs
   * @default 5
   */
  pasteMarkdownAutoConvertThreshold?: number;
  plugins?: EditorPlugin[];
  slashOption?: Partial<ReactSlashOptionProps>;
  /** Force slash menu placement direction, skipping auto-flip detection */
  slashPlacement?: 'bottom' | 'top';
  style?: CSSProperties;
}
