import { CSSProperties, FC, ReactNode } from 'react';

import { IReactEditorContent } from '@/plugins/common/react/ReactPlainText';
import { ReactSlashOptionProps } from '@/plugins/slash/react/ReactSlashPlugin';

export type EditorPlugin = FC<any> | [FC<any>, Record<string, any>];

export interface EditorProps {
  children?: ReactNode;
  className?: string;
  content?: IReactEditorContent['content'];
  mentionOption?: Partial<ReactSlashOptionProps>;
  plugins?: EditorPlugin[];
  slashOption?: Partial<ReactSlashOptionProps>;
  style?: CSSProperties;
}
