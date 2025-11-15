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
  extends Partial<ReactEditorContentProps>,
    Omit<ReactPlainTextProps, 'theme' | 'children'> {
  autoFocus?: boolean;
  children?: ReactNode;
  className?: string;
  editable?: boolean;
  editor?: IEditor;
  /**
   * Enable automatic markdown formatting for pasted content
   * @default true
   */
  enablePasteMarkdown?: boolean;
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
  plugins?: EditorPlugin[];
  slashOption?: Partial<ReactSlashOptionProps>;
  style?: CSSProperties;
}
