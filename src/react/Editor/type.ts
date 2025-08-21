import type { CSSProperties, FC, ReactNode, Ref } from 'react';

import type { ReactEditorContentProps, ReactPlainTextProps } from '@/plugins/common/react';
import type { ReactMentionPluginProps } from '@/plugins/mention/react';
import type { ReactSlashOptionProps } from '@/plugins/slash/react';
import type { IEditor } from '@/types';

export type EditorPlugin = FC<any> | [FC<any>, Record<string, any>];

interface MentionOption extends Partial<ReactSlashOptionProps> {
  markdownWriter?: ReactMentionPluginProps['markdownWriter'];
}

export interface EditorProps extends Partial<ReactEditorContentProps> {
  children?: ReactNode;
  className?: string;
  editorRef?: Ref<IEditor>;
  mentionOption?: MentionOption;
  onChange?: (editor: IEditor) => void;
  plugins?: EditorPlugin[];
  slashOption?: Partial<ReactSlashOptionProps>;
  style?: CSSProperties;
  theme?: ReactPlainTextProps['theme'];
  variant?: ReactPlainTextProps['variant'];
}
