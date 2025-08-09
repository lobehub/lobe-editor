import type { CSSProperties, FC, ReactElement } from 'react';
import React, { Children, useEffect, useLayoutEffect, useRef } from 'react';

import { IEditor } from '@/editor-kernel';
import { LexicalErrorBoundary } from '@/editor-kernel/react/LexicalErrorBoundary';
import { useLexicalComposerContext } from '@/editor-kernel/react/react-context';
import { useDecorators } from '@/editor-kernel/react/useDecorators';

import { CommonPlugin, CommonPluginOptions } from '../plugin';
import { Placeholder } from './Placeholder';
import { useStyles } from './style';
import { useThemeStyles } from './theme.style';

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
  theme?: CommonPluginOptions['theme'] & {
    fontSize?: number;
    headerMultiple?: number;
    lineHeight?: number;
    marginMultiple?: number;
  };
  variant?: 'default' | 'chat';
}

export const ReactPlainText: FC<ReactPlainTextProps> = ({
  style,
  children,
  theme = {},
  onChange,
  className,
  variant,
}) => {
  const isChat = variant === 'chat';
  const {
    fontSize = isChat ? 14 : 16,
    headerMultiple = isChat ? 1 : 0.25,
    lineHeight = isChat ? 1.8 : 1.6,
    marginMultiple = isChat ? 1 : 2,
    ...restTheme
  } = theme;
  const editorContainerRef = useRef<HTMLDivElement>(null);
  const [editor] = useLexicalComposerContext();
  const decorators = useDecorators(editor, LexicalErrorBoundary);
  const { styles: themeStyles } = useThemeStyles();
  const { cx, styles } = useStyles({ fontSize, headerMultiple, lineHeight, marginMultiple });

  const {
    props: { type, content, placeholder },
  } = Children.only(children);

  useLayoutEffect(() => {
    editor.registerPlugin(CommonPlugin, {
      theme: restTheme ? { ...themeStyles, ...restTheme } : themeStyles,
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
      onChange?.(editor);
    });
  }, []);

  return (
    <>
      <div
        className={cx(styles.root, styles.variant, className)}
        contentEditable
        ref={editorContainerRef}
        style={style}
      />
      <Placeholder style={style}>{placeholder}</Placeholder>
      {decorators}
    </>
  );
};
