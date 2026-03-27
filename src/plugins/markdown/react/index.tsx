'use client';

import { toast } from '@lobehub/ui';
import { type FC, useLayoutEffect } from 'react';

import { useLexicalComposerContext } from '@/editor-kernel/react';
import { useTranslation } from '@/editor-kernel/react/useTranslation';
import { INodePlugin } from '@/plugins/inode';

import { MarkdownPlugin } from '../plugin';

const ReactMarkdownPlugin: FC<void> = () => {
  const [editor] = useLexicalComposerContext();
  const t = useTranslation();

  useLayoutEffect(() => {
    editor.registerPlugin(INodePlugin);
    editor.registerPlugin(MarkdownPlugin);
    const handleEvent = () => {
      toast.info({
        description: t('markdown.autoFormatMessage'),
        duration: 5000,
        title: t('markdown.autoFormatTitle'),
      });
    };
    editor.on('markdownParse', handleEvent);
    return () => {
      editor.off('markdownParse', handleEvent);
    };
  }, [editor, t]);

  return null;
};

ReactMarkdownPlugin.displayName = 'ReactMarkdownPlugin';

export default ReactMarkdownPlugin;
