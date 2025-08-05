import type { CSSProperties, FC, ReactElement } from 'react';
import { Children, useEffect, useLayoutEffect, useRef } from 'react';

import { LexicalErrorBoundary } from '@/editor-kernel/react/LexicalErrorBoundary';
import { useLexicalComposerContext } from '@/editor-kernel/react/react-context';
import { useDecorators } from '@/editor-kernel/react/useDecorators';

import { CommonPlugin } from '../plugin';

export interface IReactEditorContent {
  content: any;
  type: string;
}

export const ReactEditorContent: FC<IReactEditorContent> = () => {
  return null;
};

export interface ReactPlainTextProps {
  children: ReactElement<IReactEditorContent>;
  className?: string;
  style?: CSSProperties;
}

export const ReactPlainText: FC<ReactPlainTextProps> = (props) => {
  const editorContainerRef = useRef<HTMLDivElement>(null);
  const [editor] = useLexicalComposerContext();
  const decorators = useDecorators(editor, LexicalErrorBoundary);

  useLayoutEffect(() => {
    editor.registerPlugin(CommonPlugin);
    console.info('ReactPlainText: Plugin registered');
  }, []);

  useEffect(() => {
    console.info('ReactPlainText: Layout effect triggered');
    const container = editorContainerRef.current;
    if (container) {
      // Initialize the editor
      editor.setRootElement(container);
    }
    const {
      props: { type, content },
    } = Children.only(props.children);
    editor.setDocument(type, content);
  }, []);

  return (
    <>
      <div
        className={props.className}
        contentEditable
        ref={editorContainerRef}
        style={props.style}
      />
      {decorators}
    </>
  );
};
