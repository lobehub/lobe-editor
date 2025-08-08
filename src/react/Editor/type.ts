import type { CSSProperties, FC, ReactNode } from 'react';

import type { IReactEditorContent } from '@/plugins/common/react/ReactPlainText';
import type { ReactSlashOptionProps } from '@/plugins/slash/react/ReactSlashPlugin';

export type EditorPlugin = FC<any> | [FC<any>, Record<string, any>];

export interface EditorProps {
  children?: ReactNode;
  className?: string;
  content?: IReactEditorContent['content'];
  mentionOption?: Partial<ReactSlashOptionProps>;
  placeholder?: ReactNode;
  plugins?: EditorPlugin[];
  slashOption?: Partial<ReactSlashOptionProps>;
  style?: CSSProperties;
}
