'use client';

import { Children, memo, useEffect, useLayoutEffect, useRef, useState } from 'react';

import { LexicalErrorBoundary } from '@/editor-kernel/react/LexicalErrorBoundary';
import { useLexicalComposerContext } from '@/editor-kernel/react/react-context';
import { useDecorators } from '@/editor-kernel/react/useDecorators';
import { MarkdownPlugin } from '@/plugins/markdown';

import { CommonPlugin } from '../plugin';
import Placeholder from './Placeholder';
import { useStyles, useThemeStyles } from './style';
import { ReactPlainTextProps } from './type';

const ReactPlainText = memo<ReactPlainTextProps>(
  ({
    style,
    children,
    theme = {},
    onChange,
    className,
    variant,
    onKeyDown,
    onFocus,
    onBlur,
    autoFocus,
    onCompositionStart,
    onCompositionEnd,
    onContextMenu,
  }) => {
    const isChat = variant === 'chat';
    const {
      fontSize = isChat ? 14 : 16,
      headerMultiple = isChat ? 0.25 : 1,
      lineHeight = isChat ? 1.6 : 1.8,
      marginMultiple = isChat ? 1 : 2,
      ...restTheme
    } = theme;
    const editorContainerRef = useRef<HTMLDivElement>(null);
    const [editor] = useLexicalComposerContext();
    const decorators = useDecorators(editor, LexicalErrorBoundary);
    const { styles: themeStyles } = useThemeStyles();
    const { cx, styles } = useStyles({ fontSize, headerMultiple, lineHeight, marginMultiple });
    const [isInitialized, setIsInitialized] = useState(false);

    const {
      props: { type, content, placeholder },
    } = Children.only(children);

    useLayoutEffect(() => {
      editor.registerPlugin(MarkdownPlugin);
      editor.registerPlugin(CommonPlugin, {
        theme: restTheme ? { ...themeStyles, ...restTheme } : themeStyles,
      });
    }, [editor, restTheme, themeStyles]);

    useEffect(() => {
      const container = editorContainerRef.current;
      if (container && !isInitialized) {
        // Initialize the editor
        editor.setRootElement(container);

        // Set initial document content only once
        editor.setDocument(type, content);
        setIsInitialized(true);
      }

      return editor.getLexicalEditor()?.registerUpdateListener(() => {
        onChange?.(editor);
      });
    }, [editor, type, content, onChange, isInitialized]);

    useEffect(() => {
      if (autoFocus && editorContainerRef.current) {
        editorContainerRef.current.focus();
      }
    }, [autoFocus]);

    return (
      <div className={cx(styles.root, styles.variant, className)} style={style}>
        <div
          contentEditable
          onBlur={onBlur}
          onCompositionEnd={onCompositionEnd}
          onCompositionStart={onCompositionStart}
          onContextMenu={onContextMenu}
          onFocus={onFocus}
          onKeyDown={onKeyDown}
          ref={editorContainerRef}
          style={{ outline: 'none' }}
        />
        <Placeholder style={style}>{placeholder}</Placeholder>
        {decorators}
      </div>
    );
  },
);

ReactPlainText.displayName = 'ReactPlainText';

export default ReactPlainText;
