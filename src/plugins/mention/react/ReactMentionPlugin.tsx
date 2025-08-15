'use client';

import type { FC } from 'react';
import { useLayoutEffect } from 'react';

import { useLexicalComposerContext } from '@/editor-kernel/react/react-context';
import { MarkdownPlugin } from '@/plugins/markdown';

import { MentionPlugin } from '../plugin';
import Mention from './components/Mention';
import { useStyles } from './style';
import type { ReactMentionPluginProps } from './type';

const ReactMentionPlugin: FC<ReactMentionPluginProps> = (props) => {
  const [editor] = useLexicalComposerContext();
  const { styles } = useStyles();

  useLayoutEffect(() => {
    editor.registerPlugin(MarkdownPlugin);
    editor.registerPlugin(MentionPlugin, {
      decorator: (node, editor) => {
        return <Mention className={props.className} editor={editor} node={node} />;
      },
      markdownWriter: props.markdownWriter,
      theme: props.theme || { mention: styles.editor_mention },
    });
  }, [editor]);

  return null;
};

ReactMentionPlugin.displayName = 'ReactMentionPlugin';

export default ReactMentionPlugin;
