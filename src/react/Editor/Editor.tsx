'use client';

import { debounce } from 'es-toolkit';
import { createElement, memo, useCallback, useMemo, useRef, useState } from 'react';

import { ReactEditor } from '@/editor-kernel/react/react-editor';
import { ReactEditorContent, ReactPlainText } from '@/plugins/common';
import ReactMarkdownPlugin from '@/plugins/markdown/react';
import PasteMarkdownConfirm from '@/plugins/markdown/react/PasteMarkdownConfirm';
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
    slashPlacement,
    getPopupContainer,
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
    autoFormatMarkdown = true,
    confirmPasteMarkdown,
    onPasteMarkdown,
    markdownOption = true,
    pasteAsPlainText = false,
    pasteVSCodeAsCodeBlock = true,
    onCompositionStart,
    onCompositionEnd,
    onContextMenu,
    onTextChange,
  }) => {
    const { config } = useEditorContent();

    // Built-in paste confirmation dialog state
    const pasteResolveRef = useRef<((v: boolean) => void) | null>(null);
    const [pasteDialog, setPasteDialog] = useState<{ text: string; visible: boolean }>({
      text: '',
      visible: false,
    });

    const handlePasteMarkdown = useCallback((text: string): Promise<boolean> => {
      return new Promise<boolean>((resolve) => {
        pasteResolveRef.current = resolve;
        setPasteDialog({ text, visible: true });
      });
    }, []);

    const handlePasteConfirm = useCallback(() => {
      pasteResolveRef.current?.(true);
      pasteResolveRef.current = null;
      setPasteDialog((p) => ({ ...p, visible: false }));
    }, []);

    const handlePasteCancel = useCallback(() => {
      pasteResolveRef.current?.(false);
      pasteResolveRef.current = null;
      setPasteDialog((p) => ({ ...p, visible: false }));
    }, []);
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
          [enablePasteMarkdown && autoFormatMarkdown && ReactMarkdownPlugin, ...plugins].filter(
            Boolean,
          ) as EditorPlugin[]
        ).map((plugin, index) => {
          const withNoProps = typeof plugin === 'function';
          if (withNoProps) return createElement(plugin, { key: index });
          return createElement(plugin[0], {
            key: index,
            ...plugin[1],
          });
        }),
      [plugins, enablePasteMarkdown, autoFormatMarkdown, ReactMarkdownPlugin],
    );

    const memoMention = useMemo(() => {
      if (!enableMention) return;
      return <ReactMentionPlugin className={className} markdownWriter={markdownWriter} />;
    }, [enableMention, markdownWriter, className]);

    const memoSlash = useMemo(() => {
      if (!enableSlash && !enableMention) return null;

      return (
        <ReactSlashPlugin getPopupContainer={getPopupContainer} placement={slashPlacement}>
          {enableSlash ? (
            <ReactSlashOption maxLength={8} trigger="/" {...slashOption} />
          ) : undefined}
          {enableMention ? (
            <ReactSlashOption maxLength={8} trigger="@" {...restMentionOption} />
          ) : undefined}
        </ReactSlashPlugin>
      );
    }, [
      enableSlash,
      enableMention,
      slashOption,
      slashPlacement,
      getPopupContainer,
      restMentionOption,
    ]);

    return (
      <ReactEditor config={config} editor={editor} onInit={onInit}>
        {memoPlugins}
        {memoSlash}
        {memoMention}
        <ReactPlainText
          autoFocus={autoFocus}
          autoFormatMarkdown={autoFormatMarkdown}
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
          onPasteMarkdown={confirmPasteMarkdown ? handlePasteMarkdown : onPasteMarkdown}
          onPressEnter={onPressEnter}
          onTextChange={debouncedOnTextChange}
          pasteAsPlainText={pasteAsPlainText}
          pasteVSCodeAsCodeBlock={pasteVSCodeAsCodeBlock}
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
        <PasteMarkdownConfirm
          onCancel={handlePasteCancel}
          onConfirm={handlePasteConfirm}
          text={pasteDialog.text}
          visible={pasteDialog.visible}
        />
      </ReactEditor>
    );
  },
);

Editor.displayName = 'Editor';

export default Editor;
