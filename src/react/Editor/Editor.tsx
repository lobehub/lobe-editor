'use client';

import { createElement, memo } from 'react';

import { ReactEditor } from '@/editor-kernel/react/react-editor';
import { ReactEditorContent, ReactPlainText } from '@/plugins/common';
import { ReactSlashOption, ReactSlashPlugin } from '@/plugins/slash';

import { EditorProps } from './type';

const Editor = memo<EditorProps>(
  ({
    content,
    style,
    className,
    placeholder,
    plugins = [],
    slashOption = {},
    mentionOption = {},
    children,
  }) => {
    const enableSlash = Boolean(slashOption?.items && slashOption.items.length > 0);
    const enableMention = Boolean(mentionOption?.items && mentionOption.items.length > 0);
    return (
      <ReactEditor>
        {plugins.map((plugin, index) => {
          const withNoProps = typeof plugin === 'function';
          if (withNoProps) return createElement(plugin, { key: index });
          return createElement(plugin[0], {
            key: index,
            ...plugin[1],
          });
        })}
        {(enableSlash || enableMention) && (
          <ReactSlashPlugin>
            {enableSlash ? <ReactSlashOption trigger="/" {...slashOption} /> : undefined}
            {enableMention ? <ReactSlashOption trigger="@" {...mentionOption} /> : undefined}
          </ReactSlashPlugin>
        )}
        {children}
        <ReactPlainText
          className={className}
          style={{
            ...style,
            outline: 'none',
          }}
        >
          <ReactEditorContent content={content} placeholder={placeholder} type="json" />
        </ReactPlainText>
      </ReactEditor>
    );
  },
);

Editor.displayName = 'Editor';

export default Editor;
