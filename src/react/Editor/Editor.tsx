'use client';

import { createElement, memo, useMemo } from 'react';

import { ReactEditor } from '@/editor-kernel/react/react-editor';
import { ReactEditorContent, ReactPlainText } from '@/plugins/common';
import { ReactMentionPlugin } from '@/plugins/mention';
import { ReactSlashOption, ReactSlashPlugin } from '@/plugins/slash';
import { useEditorContent } from '@/react/EditorProvider';

import { EditorProps } from './type';

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
    theme,
    children,
    type = 'json',
  }) => {
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

    return (
      <ReactEditor config={config} editorRef={editorRef}>
        {memoPlugins}
        {memoSlash}
        {memoMention}
        <ReactPlainText
          className={className}
          onChange={onChange}
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
