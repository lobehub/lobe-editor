import type { FC } from 'react';
import { useLayoutEffect } from 'react';

import { useLexicalComposerContext } from '@/editor-kernel/react/react-context';
import { MarkdownPlugin } from '@/plugins/markdown';

import { MentionNode } from '../node/MentionNode';
import { MentionPlugin } from '../plugin';
import { ReactMention } from './ReactMention';
import { useStyles } from './style';

export interface ReactMentionPluginProps {
  className?: string;
  markdownWriter?: (file: MentionNode) => string;
  theme?: {
    mention?: string;
  };
}

export const ReactMentionPlugin: FC<ReactMentionPluginProps> = (props) => {
  const [editor] = useLexicalComposerContext();
  const { styles } = useStyles();

  useLayoutEffect(() => {
    editor.registerPlugin(MarkdownPlugin);
    editor.registerPlugin(MentionPlugin, {
      decorator: (node, editor) => {
        return <ReactMention className={props.className} editor={editor} node={node} />;
      },
      markdownWriter: props.markdownWriter,
      theme: props.theme || { mention: styles.editor_mention },
    });
  }, [editor]);

  return null;
};
