/**
 * 支持通过 react children 进行配置
 */
import type { FC, Ref } from 'react';
import { ReactNode, useEffect, useMemo } from 'react';

import Editor, { IEditor } from '../';
import {
  LexicalComposerContext,
  LexicalComposerContextWithEditor,
  createLexicalComposerContext,
} from './react-context';

export interface IReactEditorProps {
  children?: ReactNode | undefined;
  editorRef?: Ref<IEditor>;
}

function updateRef<T>(ref: Ref<T> | undefined, value: T) {
  if (typeof ref === 'function') {
    ref(value);
  } else if (ref) {
    ref.current = value;
  }
}

export const ReactEditor: FC<IReactEditorProps> = ({ editorRef, children }) => {
  const composerContext = useMemo(() => {
    const editor = Editor.createEditor();
    updateRef(editorRef, editor);
    const theme = createLexicalComposerContext(null, null);
    return [editor, theme] as LexicalComposerContextWithEditor;
  }, []);

  useEffect(() => {
    return () => {
      updateRef(editorRef, undefined);
    };
  }, [editorRef]);

  return <LexicalComposerContext value={composerContext}>{children}</LexicalComposerContext>;
};
