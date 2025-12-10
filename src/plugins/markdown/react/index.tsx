'use client';

import { HistoryStateEntry } from '@lexical/history';
import { Button } from '@lobehub/ui';
import { Space, notification } from 'antd';
import { EditorState } from 'lexical';
import { type FC, useLayoutEffect } from 'react';

import { useLexicalComposerContext } from '@/editor-kernel/react';
import { useTranslation } from '@/editor-kernel/react/useTranslation';
import { INodePlugin } from '@/plugins/inode';

import { INSERT_MARKDOWN_COMMAND } from '../command';
import { MarkdownPlugin } from '../plugin';

const ReactMarkdownPlugin: FC<void> = () => {
  const [editor] = useLexicalComposerContext();
  const [api, contextHolder] = notification.useNotification();
  const t = useTranslation();

  useLayoutEffect(() => {
    editor.registerPlugin(INodePlugin);
    editor.registerPlugin(MarkdownPlugin);
    const handleEvent = ({
      markdown,
      historyState,
    }: {
      cacheState: EditorState;
      historyState: HistoryStateEntry | null;
      markdown: string;
    }) => {
      const key = `open${Date.now()}`;
      const actions = (
        <Space>
          <Button onClick={() => api.destroy()} size="small">
            {t('markdown.cancel')}
          </Button>
          <Button
            onClick={() => {
              editor.dispatchCommand(INSERT_MARKDOWN_COMMAND, { historyState, markdown });
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
        showProgress: true,
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
