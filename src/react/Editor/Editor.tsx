'use client';

import { createElement, memo } from 'react';

import { ReactEditor } from '@/editor-kernel/react/react-editor';
import { ReactEditorContent, ReactPlainText } from '@/plugins/common';
import { ReactMentionPlugin } from '@/plugins/mention';
import { ReactSlashOption, ReactSlashPlugin } from '@/plugins/slash';

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
  }) => {
    const enableSlash = Boolean(slashOption?.items && slashOption.items.length > 0);
    const enableMention = Boolean(mentionOption?.items && mentionOption.items.length > 0);
    const { markdownWriter, ...restMentionOption } = mentionOption;
    return (
      <ReactEditor editorRef={editorRef}>
        <ReactPlainText
          className={className}
          onChange={onChange}
          style={style}
          theme={theme}
          variant={variant}
        >
          <ReactEditorContent content={content} placeholder={placeholder} type="json" />
        </ReactPlainText>
        {plugins.map((plugin, index) => {
          const withNoProps = typeof plugin === 'function';
          if (withNoProps) return createElement(plugin, { key: index });
          return createElement(plugin[0], {
            key: index,
            ...plugin[1],
          });
        })}
        {enableMention && <ReactMentionPlugin markdownWriter={markdownWriter} />}
        {(enableSlash || enableMention) && (
          <ReactSlashPlugin>
            {enableSlash ? (
              <ReactSlashOption maxLength={1} trigger="/" {...slashOption} />
            ) : undefined}
            {enableMention ? (
              <ReactSlashOption maxLength={6} trigger="@" {...restMentionOption} />
            ) : undefined}
          </ReactSlashPlugin>
        )}
        {children}
      </ReactEditor>
    );
  },
);

Editor.displayName = 'Editor';

export default Editor;
