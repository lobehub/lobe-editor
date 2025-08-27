/**
 * Support configuration through react children
 */
import { type FC, type ReactNode, type Ref, useEffect, useMemo } from 'react';

import type { IEditor } from '@/types';

import Editor from '../';
import {
  LexicalComposerContext,
  LexicalComposerContextWithEditor,
  createLexicalComposerContext,
  useLexicalComposerContext,
} from './react-context';

export interface IReactEditorProps {
  children?: ReactNode | undefined;
  /** Editor configuration */
  config?: Record<string, any>;
  editorRef?: Ref<IEditor>;
}

function updateRef<T>(ref: Ref<T> | undefined, value: T) {
  if (typeof ref === 'function') {
    ref(value);
  } else if (ref) {
    ref.current = value;
  }
}

// Configuration injection component
const ConfigInjector: FC<{ config?: Record<string, any> }> = ({ config }) => {
  const [editor] = useLexicalComposerContext();

  useEffect(() => {
    if (config?.locale && Object.keys(config.locale).length > 0) {
      editor.registerLocale(config.locale);
    }
  }, [editor, config]);

  return null;
};

export const ReactEditor: FC<IReactEditorProps> = ({ editorRef, children, config }) => {
  const composerContext = useMemo(() => {
    const editor = Editor.createEditor();
    const theme = createLexicalComposerContext(null, null);
    return [editor, theme] as LexicalComposerContextWithEditor;
  }, []);

  useEffect(() => {
    updateRef(editorRef, composerContext[0]);
    return () => {
      updateRef(editorRef, undefined);
    };
  }, [editorRef, composerContext]);

  return (
    <LexicalComposerContext value={composerContext}>
      <ConfigInjector config={config} />
      {children}
    </LexicalComposerContext>
  );
};
