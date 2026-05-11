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

  // 用于区分 React StrictMode 模拟卸载和真正卸载
  const pendingDestroyRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    const editor = composerContext[0];

    // StrictMode 假卸载：取消 microtask 中的 destroy，勿同步调用 destroy（见 useEditor 注释）。
    if (pendingDestroyRef.current) {
      pendingDestroyRef.current = null;
    }

    // Call onInit callback
    if (onInit) {
      onInit(editor);
    }

    return () => {
      // 延迟到 microtask 执行，给 StrictMode remount 留出时间
      pendingDestroyRef.current = () => {
        editor.destroy();
      };
      queueMicrotask(() => {
        if (pendingDestroyRef.current) {
          pendingDestroyRef.current();
          pendingDestroyRef.current = null;
        }
      });
    };
  }, [composerContext, onInit]);

  return (
    <LexicalComposerContext value={composerContext}>
      <ConfigInjector config={config} />
      {children}
    </LexicalComposerContext>
  );
};
