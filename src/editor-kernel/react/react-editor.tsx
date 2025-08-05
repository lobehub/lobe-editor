/**
 * 支持通过 react children 进行配置
 */
import type { FC } from 'react';
import { ReactNode, useMemo } from 'react';

import Editor from '../';
import {
  LexicalComposerContext,
  LexicalComposerContextWithEditor,
  createLexicalComposerContext,
} from './react-context';

export interface IReactEditorProps {
  children?: ReactNode | undefined;
}

export const ReactEditor: FC<IReactEditorProps> = (props) => {
  const composerContext = useMemo(() => {
    const editor = Editor.createEditor();
    const theme = createLexicalComposerContext(null, null);
    return [editor, theme] as LexicalComposerContextWithEditor;
  }, []);

  return <LexicalComposerContext value={composerContext}>{props.children}</LexicalComposerContext>;
};
