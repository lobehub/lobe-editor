'use client';

import { type FC, useLayoutEffect } from 'react';

import { useLexicalComposerContext } from '@/editor-kernel/react/react-context';
import { MarkdownPlugin } from '@/plugins/markdown';

import { CodePlugin } from '../plugin';
import { useStyles } from './style';
import { ReactCodePluginProps } from './type';

const ReactCodePlugin: FC<ReactCodePluginProps> = ({ className, enableHotkey = true }) => {
  const [editor] = useLexicalComposerContext();
  const { cx, styles } = useStyles();

  useLayoutEffect(() => {
    editor.registerPlugin(MarkdownPlugin);
    editor.registerPlugin(CodePlugin, {
      enableHotkey,
      theme: cx(styles.codeInline, className),
    });
  }, [className, cx, enableHotkey, styles.codeInline]);

  return null;
};

ReactCodePlugin.displayName = 'ReactCodePlugin';

export default ReactCodePlugin;
