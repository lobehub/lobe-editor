import type { CSSProperties, FC, ReactElement } from 'react';
import React, { Children, useEffect, useLayoutEffect, useRef } from 'react';

import { IEditor } from '@/editor-kernel';
import { LexicalErrorBoundary } from '@/editor-kernel/react/LexicalErrorBoundary';
import { useLexicalComposerContext } from '@/editor-kernel/react/react-context';
import { useDecorators } from '@/editor-kernel/react/useDecorators';

import { CommonPlugin, CommonPluginOptions } from '../plugin';
import { Placeholder } from './Placeholder';
import { useStyles } from './style';

export interface IReactEditorContent {
  content: any;
  placeholder?: React.ReactNode;
  type: string;
}

export const ReactEditorContent: FC<IReactEditorContent> = () => {
  return null;
};

export interface ReactPlainTextProps {
  children: ReactElement<IReactEditorContent>;
  className?: string;
  onChange?: (editor: IEditor) => void;
  style?: CSSProperties;
  theme?: CommonPluginOptions['theme'];
}

export const ReactPlainText: FC<ReactPlainTextProps> = (props) => {
  const editorContainerRef = useRef<HTMLDivElement>(null);
  const [editor] = useLexicalComposerContext();
  const decorators = useDecorators(editor, LexicalErrorBoundary);
  const { styles } = useStyles();

  const {
    props: { type, content, placeholder },
  } = Children.only(props.children);

  useLayoutEffect(() => {
    editor.registerPlugin(CommonPlugin, {
      theme: props.theme ? { ...styles, ...props.theme } : styles,
    });
  }, []);

  useEffect(() => {
    const container = editorContainerRef.current;
    if (container) {
      // Initialize the editor
      editor.setRootElement(container);
    }

    editor.setDocument(type, content);

    return editor.getLexicalEditor()?.registerUpdateListener(() => {
      props.onChange?.(editor);
    });
  }, []);

  return (
    <>
      <div
        className={props.className}
        contentEditable
        ref={editorContainerRef}
        style={props.style}
      />
      <Placeholder style={props.style}>{placeholder}</Placeholder>
      {decorators}
    </>
  );
};
