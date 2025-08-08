import type { CSSProperties, FC, ReactNode, Ref } from 'react';

import type { IEditor } from '@/editor-kernel';
import type { IReactEditorContent } from '@/plugins/common/react/ReactPlainText';
import type { ReactSlashOptionProps } from '@/plugins/slash/react/ReactSlashPlugin';

export type EditorPlugin = FC<any> | [FC<any>, Record<string, any>];

export interface EditorProps {
  children?: ReactNode;
  className?: string;
  content?: IReactEditorContent['content'];
  editorRef?: Ref<IEditor>;
  mentionOption?: Partial<ReactSlashOptionProps>;
  placeholder?: ReactNode;
  plugins?: EditorPlugin[];
  slashOption?: Partial<ReactSlashOptionProps>;
  style?: CSSProperties;
}
