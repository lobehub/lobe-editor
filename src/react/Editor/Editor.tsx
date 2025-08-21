'use client';

import { isModifierMatch } from 'lexical';
import { type KeyboardEvent, createElement, memo, useMemo } from 'react';
import { mergeRefs } from 'react-merge-refs';

import { CONTROL_OR_META } from '@/common/sys';
import { ReactEditor } from '@/editor-kernel/react/react-editor';
import { ReactEditorContent, ReactPlainText } from '@/plugins/common';
import { ReactMentionPlugin } from '@/plugins/mention';
import { ReactSlashOption, ReactSlashPlugin } from '@/plugins/slash';
import { useEditorContent } from '@/react/EditorProvider';
import { IEditor } from '@/types';

import { EditorProps } from './type';
import { useEditor } from './useEditor';

const Editor = memo<EditorProps>(
  ({
    content,
    style,
    className,
    editorRef,
    onChange,
    placeholder,
    plugins = [],
    slashOption = {},
    mentionOption = {},
    variant,
    onKeyDown,
    theme,
    children,
    type = 'json',
    onPressEnter,
    onFocus,
    onBlur,
    autoFocus,
    onCompositionStart,
    onCompositionEnd,
    onContextMenu,
  }) => {
    const ref = useEditor();
    const { config } = useEditorContent();
    const enableSlash = Boolean(slashOption?.items && slashOption.items.length > 0);
    const enableMention = Boolean(mentionOption?.items && mentionOption.items.length > 0);
    const { markdownWriter, ...restMentionOption } = mentionOption;

    const memoPlugins = useMemo(
      () =>
        plugins.map((plugin, index) => {
          const withNoProps = typeof plugin === 'function';
          if (withNoProps) return createElement(plugin, { key: index });
          return createElement(plugin[0], {
            key: index,
            ...plugin[1],
          });
        }),
      [plugins],
    );

    const memoMention = useMemo(() => {
      if (!enableMention) return;
      return <ReactMentionPlugin markdownWriter={markdownWriter} />;
    }, [enableMention, markdownWriter]);

    const memoSlash = useMemo(() => {
      if (!enableSlash && !enableMention) return null;

      return (
        <ReactSlashPlugin>
          {enableSlash ? (
            <ReactSlashOption maxLength={1} trigger="/" {...slashOption} />
          ) : undefined}
          {enableMention ? (
            <ReactSlashOption maxLength={6} trigger="@" {...restMentionOption} />
          ) : undefined}
        </ReactSlashPlugin>
      );
    }, [enableSlash, enableMention, slashOption, restMentionOption]);

    const handleKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
      // Check if currently composing (e.g., typing with IME)
      const isComposing = e.nativeEvent.isComposing;

      // Handle Enter key press
      if (e.key === 'Enter' && !isComposing) {
        // Support for Ctrl/Cmd + Enter for forced submit
        if (isModifierMatch(e.nativeEvent, CONTROL_OR_META) && onPressEnter) {
          // Force submit with modifier key
          onPressEnter(e);
          return;
        }

        // Regular Enter key handling
        if (onPressEnter) {
          onPressEnter(e);
        }
      }

      // Call the optional onKeyDown handler
      onKeyDown?.(e);
    };

    return (
      <ReactEditor config={config} editorRef={mergeRefs<IEditor>([ref, editorRef])}>
        {memoPlugins}
        {memoSlash}
        {memoMention}
        <ReactPlainText
          autoFocus={autoFocus}
          className={className}
          onBlur={onBlur}
          onChange={onChange}
          onCompositionEnd={onCompositionEnd}
          onCompositionStart={onCompositionStart}
          onContextMenu={onContextMenu}
          onFocus={onFocus}
          onKeyDown={handleKeyDown}
          style={style}
          theme={theme}
          variant={variant}
        >
          <ReactEditorContent content={content} placeholder={placeholder} type={type} />
        </ReactPlainText>
        {children}
      </ReactEditor>
    );
  },
);

Editor.displayName = 'Editor';

export default Editor;
