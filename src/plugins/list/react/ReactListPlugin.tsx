'use client';

import { type FC, useLayoutEffect } from 'react';

import { useLexicalComposerContext } from '@/editor-kernel/react/react-context';
import { MarkdownPlugin } from '@/plugins/markdown';

import { ListPlugin } from '../plugin';
import { useStyles } from './style';
import { ReactListPluginProps } from './type';

const ReactListPlugin: FC<ReactListPluginProps> = () => {
  const [editor] = useLexicalComposerContext();
  const { styles } = useStyles();

  useLayoutEffect(() => {
    editor.registerPlugin(MarkdownPlugin);
    editor.registerPlugin(ListPlugin, {
      theme: styles,
    });
  }, []);

  return null;
};

ReactListPlugin.displayName = 'ReactListPlugin';

export default ReactListPlugin;
