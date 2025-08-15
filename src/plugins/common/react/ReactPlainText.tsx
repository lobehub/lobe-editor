'use client';

import { Children, memo, useEffect, useLayoutEffect, useRef } from 'react';

import { LexicalErrorBoundary } from '@/editor-kernel/react/LexicalErrorBoundary';
import { useLexicalComposerContext } from '@/editor-kernel/react/react-context';
import { useDecorators } from '@/editor-kernel/react/useDecorators';
import { MarkdownPlugin } from '@/plugins/markdown';

import { CommonPlugin } from '../plugin';
import Placeholder from './Placeholder';
import { useStyles, useThemeStyles } from './style';
import { ReactPlainTextProps } from './type';

const ReactPlainText = memo<ReactPlainTextProps>(
  ({ style, children, theme = {}, onChange, className, variant }) => {
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

    const {
      props: { type, content, placeholder },
    } = Children.only(children);

    useLayoutEffect(() => {
      editor.registerPlugin(MarkdownPlugin);
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
      <div className={cx(styles.root, styles.variant, className)} style={style}>
        <div contentEditable ref={editorContainerRef} style={{ outline: 'none' }} />
        <Placeholder style={style}>{placeholder}</Placeholder>
        {decorators}
      </div>
    );
  },
);

ReactPlainText.displayName = 'ReactPlainText';

export default ReactPlainText;
