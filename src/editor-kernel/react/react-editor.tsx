/**
 * Support configuration through react children
 */
import { type FC, type ReactNode, useEffect, useMemo, useRef } from 'react';

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
  /** Editor instance to use */
  editor?: IEditor;
  /** Callback called when editor is initialized */
  onInit?: (editor: IEditor) => void;
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

export const ReactEditor: FC<IReactEditorProps> = ({
  editor: editorProp,
  children,
  config,
  onInit,
}) => {
  const composerContext = useMemo(() => {
    const editor = editorProp || Editor.createEditor();
    const theme = createLexicalComposerContext(null, null);
    return [editor, theme] as LexicalComposerContextWithEditor;
  }, [editorProp]);

  const onInitRef = useRef(onInit);
  onInitRef.current = onInit;

  useEffect(() => {
    const editor = composerContext[0];
    onInitRef.current?.(editor);
  }, [composerContext]);

  return (
    <LexicalComposerContext value={composerContext}>
      <ConfigInjector config={config} />
      {children}
    </LexicalComposerContext>
  );
};
