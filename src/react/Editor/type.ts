import type { CSSProperties, FC, ReactNode, Ref } from 'react';

import type { IEditor } from '@/editor-kernel';
import type { ReactEditorContentProps, ReactPlainTextProps } from '@/plugins/common/react';
import type { ReactSlashOptionProps } from '@/plugins/slash/react';

export type EditorPlugin = FC<any> | [FC<any>, Record<string, any>];

export interface EditorProps {
  children?: ReactNode;
  className?: string;
  content?: ReactEditorContentProps['content'];
  editorRef?: Ref<IEditor>;
  mentionOption?: Partial<ReactSlashOptionProps>;
  onChange?: (editor: IEditor) => void;
  placeholder?: ReactNode;
  plugins?: EditorPlugin[];
  slashOption?: Partial<ReactSlashOptionProps>;
  style?: CSSProperties;
  theme?: ReactPlainTextProps['theme'];
  variant?: ReactPlainTextProps['variant'];
}
