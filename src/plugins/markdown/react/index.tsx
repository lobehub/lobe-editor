'use client';

import { Button, Space, notification } from 'antd';
import { EditorState, UNDO_COMMAND } from 'lexical';
import { type FC, useLayoutEffect } from 'react';

import { useLexicalComposerContext } from '@/editor-kernel/react';
import { useTranslation } from '@/editor-kernel/react/useTranslation';

import { INSERT_MARKDOWN_COMMAND } from '../command';
import { MarkdownPlugin } from '../plugin';

const ReactMarkdownPlugin: FC<void> = () => {
  const [editor] = useLexicalComposerContext();
  const [api, contextHolder] = notification.useNotification();
  const t = useTranslation();

  useLayoutEffect(() => {
    editor.registerPlugin(MarkdownPlugin);
    const handleEvent = ({ markdown }: { cacheState: EditorState; markdown: string }) => {
      const key = `open${Date.now()}`;
      const actions = (
        <Space>
          <Button onClick={() => api.destroy()} size="small" type="link">
            {t('markdown.cancel')}
          </Button>
          <Button
            onClick={() => {
              editor.dispatchCommand(UNDO_COMMAND, undefined);
              editor.dispatchCommand(INSERT_MARKDOWN_COMMAND, { markdown });
              api.destroy();
            }}
            size="small"
            type="primary"
          >
            {t('markdown.confirm')}
          </Button>
        </Space>
      );
      api.open({
        actions,
        description: t('markdown.parseMessage'),
        duration: 5,
        key,
        message: t('markdown.parseTitle'),
        onClose: close,
      });
    };
    editor.on('markdownParse', handleEvent);
    return () => {
      editor.off('markdownParse', handleEvent);
    };
  }, [editor]);

  return contextHolder;
};

ReactMarkdownPlugin.displayName = 'ReactMarkdownPlugin';

export default ReactMarkdownPlugin;
