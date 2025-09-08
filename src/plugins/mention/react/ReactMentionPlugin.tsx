'use client';

import { type FC, useLayoutEffect } from 'react';

import { useLexicalComposerContext } from '@/editor-kernel/react/react-context';
import { MarkdownPlugin } from '@/plugins/markdown';

import { MentionPlugin } from '../plugin';
import Mention from './components/Mention';
import { useStyles } from './style';
import type { ReactMentionPluginProps } from './type';

const ReactMentionPlugin: FC<ReactMentionPluginProps> = ({ className, theme, markdownWriter }) => {
  const [editor] = useLexicalComposerContext();
  const { styles } = useStyles();

  useLayoutEffect(() => {
    editor.registerPlugin(MarkdownPlugin);
    editor.registerPlugin(MentionPlugin, {
      decorator: (node, editor) => {
        return <Mention className={className} editor={editor} node={node} />;
      },
      markdownWriter: markdownWriter,
      theme: theme || styles,
    });
  }, [editor, className, markdownWriter, theme, styles]);

  return null;
};

ReactMentionPlugin.displayName = 'ReactMentionPlugin';

export default ReactMentionPlugin;
