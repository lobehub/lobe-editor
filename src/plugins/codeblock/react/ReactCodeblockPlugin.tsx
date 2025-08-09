import type { FC } from 'react';
import { useLayoutEffect } from 'react';

import { useLexicalComposerContext } from '@/editor-kernel/react/react-context';
import { MarkdownPlugin } from '@/plugins/markdown';

import { CodeblockPlugin, CodeblockPluginOptions } from '../plugin';
import { useStyles } from './style';

export interface ReactCodeblockPluginProps extends CodeblockPluginOptions {
  className?: string;
  shikiTheme?: string;
}

export const ReactCodeblockPlugin: FC<ReactCodeblockPluginProps> = ({ theme, shikiTheme }) => {
  const [editor] = useLexicalComposerContext();
  const { styles } = useStyles();

  useLayoutEffect(() => {
    editor.registerPlugin(MarkdownPlugin);
    editor.registerPlugin(CodeblockPlugin, {
      shikiTheme,
      theme: theme || {
        code: styles.editorCode,
      },
    });
  }, []);

  return null;
};
