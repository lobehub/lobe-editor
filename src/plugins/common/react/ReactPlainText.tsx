'use client';

import { COMMAND_PRIORITY_EDITOR, KEY_DOWN_COMMAND } from 'lexical';
import {
  Children,
  type CompositionEvent,
  type FocusEvent,
  type MouseEvent,
  memo,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';

import { LexicalErrorBoundary } from '@/editor-kernel/react/LexicalErrorBoundary';
import { useLexicalComposerContext } from '@/editor-kernel/react/react-context';
import { useDecorators } from '@/editor-kernel/react/useDecorators';
import { MarkdownPlugin } from '@/plugins/markdown';

import { CommonPlugin } from '../plugin';
import Placeholder from './Placeholder';
import { useStyles, useThemeStyles } from './style';
import type { ReactPlainTextProps } from './type';

const ReactPlainText = memo<ReactPlainTextProps>(
  ({
    style,
    children,
    theme = {},
    onChange,
    className,
    variant,
    enableHotkey = true,
    enablePasteMarkdown = true,
    markdownOption = true,
    onKeyDown,
    onFocus,
    onBlur,
    autoFocus,
    onPressEnter,
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
    const { styles: themeStyles } = useThemeStyles(markdownOption);
    const { cx, styles } = useStyles({ fontSize, headerMultiple, lineHeight, marginMultiple });
    const [isInitialized, setIsInitialized] = useState(false);

    const {
      props: { type, content, placeholder },
    } = Children.only(children);

    useLayoutEffect(() => {
      editor.registerPlugin(MarkdownPlugin, {
        enablePasteMarkdown,
      });
      editor.registerPlugin(CommonPlugin, {
        enableHotkey,
        markdownOption,
        theme: restTheme ? { ...themeStyles, ...restTheme } : themeStyles,
      });
    }, [editor, enableHotkey, enablePasteMarkdown, markdownOption, restTheme, themeStyles]);

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
      if (editor && onPressEnter) {
        return editor.registerHighCommand(
          KEY_DOWN_COMMAND,
          (event) => {
            if (event.key === 'Enter' && !event.isComposing && onPressEnter({ editor, event })) {
              event.preventDefault();
              return true; // Indicate that the event has been handled
            }

            //
            if (onKeyDown?.({ editor, event })) {
              event.preventDefault();
              return true; // Indicate that the event has been handled
            }

            return false; // Allow other handlers to process the event
          },
          COMMAND_PRIORITY_EDITOR,
        );
      }
    }, [editor, onPressEnter, onKeyDown]);

    useEffect(() => {
      if (autoFocus && editorContainerRef.current) {
        editorContainerRef.current.focus();
      }
    }, [autoFocus]);

    const handleBlur = (event: FocusEvent<HTMLDivElement>) => {
      onBlur?.({ editor, event });
    };

    const handleCompositionEnd = (event: CompositionEvent<HTMLDivElement>) => {
      onCompositionEnd?.({ editor, event });
    };

    const handleCompositionStart = (event: CompositionEvent<HTMLDivElement>) => {
      onCompositionStart?.({ editor, event });
    };

    const handleContextMenu = (event: MouseEvent<HTMLDivElement>) => {
      onContextMenu?.({ editor, event });
    };

    const handleFocus = (event: FocusEvent<HTMLDivElement>) => {
      onFocus?.({ editor, event });
    };

    return (
      <div
        className={cx(
          styles.root,
          markdownOption === true && styles.variant,
          markdownOption === false && styles.noHeader,
          typeof markdownOption === 'object' && markdownOption.header === true && styles.header,
          typeof markdownOption === 'object' && markdownOption.header === false && styles.noHeader,
          typeof markdownOption === 'object' && markdownOption.code === true && styles.code,
          typeof markdownOption === 'object' && markdownOption.quote === true && styles.blockquote,
          className,
        )}
        style={style}
      >
        <div
          contentEditable
          onBlur={handleBlur}
          onCompositionEnd={handleCompositionEnd}
          onCompositionStart={handleCompositionStart}
          onContextMenu={handleContextMenu}
          onFocus={handleFocus}
          ref={editorContainerRef}
          style={{ flex: 1, minHeight: 0, outline: 'none' }}
        />
        <Placeholder style={style}>{placeholder}</Placeholder>
        {decorators}
      </div>
    );
  },
);

ReactPlainText.displayName = 'ReactPlainText';

export default ReactPlainText;
