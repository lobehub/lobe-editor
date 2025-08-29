'use client';

import { type FC, useLayoutEffect } from 'react';

import { useLexicalComposerContext } from '@/editor-kernel/react/react-context';
import { MarkdownPlugin } from '@/plugins/markdown';

import { CodePlugin } from '../plugin';
import { useStyles } from './style';
import { ReactCodePluginProps } from './type';

const ReactCodePlugin: FC<ReactCodePluginProps> = ({ className }) => {
  const [editor] = useLexicalComposerContext();
  const { cx, styles } = useStyles();

  useLayoutEffect(() => {
    editor.registerPlugin(MarkdownPlugin);
    editor.registerPlugin(CodePlugin, {
      theme: cx(styles.codeInline, className),
    });
  }, []);

  return null;
};

ReactCodePlugin.displayName = 'ReactCodePlugin';

export default ReactCodePlugin;
