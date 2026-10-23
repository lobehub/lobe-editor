'use client';

import { cx } from '@lobehub/ui';
import { type FC, useLayoutEffect } from 'react';

import { useLexicalComposerContext } from '@/editor-kernel/react/react-context';
import { MarkdownPlugin } from '@/plugins/markdown/plugin';

import { CodeblockPlugin } from '../plugin';
import { styles } from './style';
import type { ReactCodeblockPluginProps } from './type';

export const ReactCodeblockPlugin: FC<ReactCodeblockPluginProps> = ({ theme, codeTheme }) => {
  const [editor] = useLexicalComposerContext();
  const codeStyle = cx(styles.code);

  useLayoutEffect(() => {
    editor.registerPlugin(MarkdownPlugin);
    editor.registerPlugin(CodeblockPlugin, {
      codeTheme: codeTheme || 'lobe-theme',
      theme: theme || { code: styles.code },
    });
  }, [codeStyle, editor, codeTheme, theme]);

  return null;
};

ReactCodeblockPlugin.displayName = 'ReactCodeblockPlugin';

export default ReactCodeblockPlugin;
