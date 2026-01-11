'use client';

import { debounce } from 'es-toolkit';
import { createElement, memo, useMemo } from 'react';

import { ReactEditor } from '@/editor-kernel/react/react-editor';
import { ReactEditorContent, ReactPlainText } from '@/plugins/common';
import ReactMarkdownPlugin from '@/plugins/markdown/react';
import { ReactMentionPlugin } from '@/plugins/mention';
import { ReactSlashOption, ReactSlashPlugin } from '@/plugins/slash';
import { useEditorContent } from '@/react/EditorProvider';

import { EditorPlugin, EditorProps } from './type';

// Keep memo: Core editor component with complex useMemo calculations and plugin system
const Editor = memo<EditorProps>(
  ({
    content,
    style,
    className,
    debounceWait = 100,
    editable,
    editor,
    onInit,
    onChange,
    placeholder,
    lineEmptyPlaceholder,
    plugins = [],
    slashOption = {},
    mentionOption = {},
    variant,
    onKeyDown,
    children,
    type = 'json',
    onPressEnter,
    onFocus,
    onBlur,
    autoFocus,
    enablePasteMarkdown = true,
    markdownOption = true,
    pasteAsPlainText = false,
    onCompositionStart,
    onCompositionEnd,
    onContextMenu,
    onTextChange,
  }) => {
    const { config } = useEditorContent();
    const enableSlash = Boolean(slashOption?.items && slashOption.items.length > 0);
    const enableMention = Boolean(mentionOption?.items && mentionOption.items.length > 0);
    const { markdownWriter, ...restMentionOption } = mentionOption;

    // Create debounced versions of onChange and onTextChange
    const debouncedOnChange = useMemo(
      () => (onChange ? debounce(onChange, debounceWait) : undefined),
      [onChange, debounceWait],
    );

    const debouncedOnTextChange = useMemo(
      () => (onTextChange ? debounce(onTextChange, debounceWait) : undefined),
      [onTextChange, debounceWait],
    );

    const memoPlugins = useMemo(
      () =>
        (
          [enablePasteMarkdown && ReactMarkdownPlugin, ...plugins].filter(Boolean) as EditorPlugin[]
        ).map((plugin, index) => {
          const withNoProps = typeof plugin === 'function';
          if (withNoProps) return createElement(plugin, { key: index });
          return createElement(plugin[0], {
            key: index,
            ...plugin[1],
          });
        }),
      [plugins, enablePasteMarkdown, ReactMarkdownPlugin],
    );

    const memoMention = useMemo(() => {
      if (!enableMention) return;
      return <ReactMentionPlugin className={className} markdownWriter={markdownWriter} />;
    }, [enableMention, markdownWriter, className]);

    const memoSlash = useMemo(() => {
      if (!enableSlash && !enableMention) return null;

      return (
        <ReactSlashPlugin>
          {enableSlash ? (
            <ReactSlashOption maxLength={8} trigger="/" {...slashOption} />
          ) : undefined}
          {enableMention ? (
            <ReactSlashOption maxLength={8} trigger="@" {...restMentionOption} />
          ) : undefined}
        </ReactSlashPlugin>
      );
    }, [enableSlash, enableMention, slashOption, restMentionOption]);

    return (
      <ReactEditor config={config} editor={editor} onInit={onInit}>
        {memoPlugins}
        {memoSlash}
        {memoMention}
        <ReactPlainText
          autoFocus={autoFocus}
          className={className}
          editable={editable}
          enablePasteMarkdown={enablePasteMarkdown}
          markdownOption={markdownOption}
          onBlur={onBlur}
          onChange={debouncedOnChange}
          onCompositionEnd={onCompositionEnd}
          onCompositionStart={onCompositionStart}
          onContextMenu={onContextMenu}
          onFocus={onFocus}
          onKeyDown={onKeyDown}
          onPressEnter={onPressEnter}
          onTextChange={debouncedOnTextChange}
          pasteAsPlainText={pasteAsPlainText}
          style={style}
          variant={variant}
        >
          <ReactEditorContent
            content={content}
            lineEmptyPlaceholder={lineEmptyPlaceholder}
            placeholder={placeholder}
            type={type}
          />
        </ReactPlainText>
        {children}
      </ReactEditor>
    );
  },
);

Editor.displayName = 'Editor';

export default Editor;
