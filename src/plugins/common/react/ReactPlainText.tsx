'use client';

import { cx } from 'antd-style';
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
import { useMemo } from 'react';

import { LexicalErrorBoundary } from '@/editor-kernel/react/LexicalErrorBoundary';
import { useLexicalComposerContext } from '@/editor-kernel/react/react-context';
import { useDecorators } from '@/editor-kernel/react/useDecorators';
import { MarkdownPlugin } from '@/plugins/markdown/plugin';

import { CommonPlugin } from '../plugin';
import Placeholder from './Placeholder';
import { styles, themeStyles } from './style';
import type { ReactPlainTextProps } from './type';

// Keep memo: Core editor rendering layer with complex event handling and decorator management
const ReactPlainText = memo<ReactPlainTextProps>(
  ({
    style,
    children,
    theme = {},
    onChange,
    editable,
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
    onTextChange,
  }) => {
    const isChat = variant === 'chat';
    const {
      fontSize = isChat ? 14 : 16,
      headerMultiple = isChat ? 0.25 : 0.6,
      lineHeight = isChat ? 1.6 : 1.8,
      marginMultiple = isChat ? 1 : 2,
      ...restTheme
    } = theme;
    const editorContainerRef = useRef<HTMLDivElement>(null);
    const [editor] = useLexicalComposerContext();
    const decorators = useDecorators(editor, LexicalErrorBoundary);

    const cssVariables = useMemo<Record<string, string>>(
      () => ({
        '--common-font-size': `${fontSize}px`,
        '--common-header-multiple': String(headerMultiple),
        '--common-line-height': String(lineHeight),
        '--common-margin-multiple': String(marginMultiple),
      }),
      [fontSize, headerMultiple, marginMultiple, lineHeight],
    );

    const computedThemeStyles = useMemo(() => {
      const bold =
        markdownOption === true ||
        (typeof markdownOption === 'object' && markdownOption.bold === true);
      const italic =
        markdownOption === true ||
        (typeof markdownOption === 'object' && markdownOption.italic === true);
      const strikethrough =
        markdownOption === true ||
        (typeof markdownOption === 'object' && markdownOption.strikethrough === true);
      const underline =
        markdownOption === true ||
        (typeof markdownOption === 'object' && markdownOption.underline === true);
      const underlineStrikethrough =
        markdownOption === true ||
        (typeof markdownOption === 'object' && markdownOption.underlineStrikethrough === true);

      return {
        quote: themeStyles.quote,
        textBold: bold ? themeStyles.textBold_true : themeStyles.textBold_false,
        textCode: themeStyles.textCode,
        textItalic: italic ? themeStyles.textItalic_true : themeStyles.textItalic_false,
        textStrikethrough: strikethrough
          ? themeStyles.textStrikethrough_true
          : themeStyles.textStrikethrough_false,
        textUnderline: underline ? themeStyles.textUnderline_true : themeStyles.textUnderline_false,
        textUnderlineStrikethrough: underlineStrikethrough
          ? themeStyles.textUnderlineStrikethrough_true
          : themeStyles.textUnderlineStrikethrough_false,
      };
    }, [markdownOption]);
    const [isInitialized, setIsInitialized] = useState(false);

    const {
      props: { type, content, placeholder, lineEmptyPlaceholder },
    } = Children.only(children);

    useLayoutEffect(() => {
      editor.registerPlugin(MarkdownPlugin, {
        enablePasteMarkdown,
      });
      editor.registerPlugin(CommonPlugin, {
        enableHotkey,
        markdownOption,
        theme: restTheme ? { ...computedThemeStyles, ...restTheme } : computedThemeStyles,
      });
    }, [editor, enableHotkey, enablePasteMarkdown, markdownOption, restTheme, computedThemeStyles]);

    useEffect(() => {
      const container = editorContainerRef.current;
      if (container && !isInitialized) {
        // Initialize the editor
        editor.setRootElement(container, editable);

        // Set initial document content only once
        editor.setDocument(type, content);
        setIsInitialized(true);
      }

      // Track previous content for onTextChange comparison
      let previousContent: string | undefined;

      return editor.getLexicalEditor()?.registerUpdateListener(({ dirtyElements, dirtyLeaves }) => {
        // Always trigger onChange for any update
        onChange?.(editor);

        // Only trigger onTextChange when content actually changes
        if (onTextChange && (dirtyElements.size > 0 || dirtyLeaves.size > 0)) {
          const currentContent = JSON.stringify(editor.getDocument(type));
          if (previousContent === undefined) {
            // First update after initialization
            previousContent = currentContent;
          } else if (currentContent !== previousContent) {
            // Content has actually changed
            previousContent = currentContent;
            onTextChange(editor);
          }
        }
      });
    }, [editor, type, content, onChange, onTextChange, isInitialized]);

    useEffect(() => {
      if (!isInitialized) return;
      if (typeof editable === 'boolean') {
        editor.setEditable(editable);
      }
    }, [isInitialized, editable]);

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
          markdownOption === false && styles.noStyle,
          markdownOption === false && styles.noHeader,
          typeof markdownOption === 'object' && markdownOption.header === true && styles.header,
          typeof markdownOption === 'object' && markdownOption.header === false && styles.noHeader,
          typeof markdownOption === 'object' && markdownOption.code === true && styles.code,
          typeof markdownOption === 'object' && markdownOption.quote === true && styles.blockquote,
          className,
        )}
        style={{
          ...cssVariables,
          ...style,
        }}
      >
        <div
          className={styles.editorContent}
          contentEditable={editable ?? true}
          onBlur={handleBlur}
          onCompositionEnd={handleCompositionEnd}
          onCompositionStart={handleCompositionStart}
          onContextMenu={handleContextMenu}
          onFocus={handleFocus}
          ref={editorContainerRef}
        />
        <Placeholder lineEmptyPlaceholder={lineEmptyPlaceholder} style={style}>
          {placeholder}
        </Placeholder>
        {decorators}
      </div>
    );
  },
);

ReactPlainText.displayName = 'ReactPlainText';

export default ReactPlainText;
