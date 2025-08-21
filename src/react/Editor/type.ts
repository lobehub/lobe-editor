import type { CSSProperties, FC, ReactNode, RefObject } from 'react';

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
  editorRef?: RefObject<IEditor | null>;
  mentionOption?: MentionOption;
  plugins?: EditorPlugin[];
  slashOption?: Partial<ReactSlashOptionProps>;
  style?: CSSProperties;
}
