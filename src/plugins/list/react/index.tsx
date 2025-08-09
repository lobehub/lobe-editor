import type { FC } from 'react';
import { useLayoutEffect } from 'react';

import { useLexicalComposerContext } from '@/editor-kernel/react/react-context';
import { MarkdownPlugin } from '@/plugins/markdown';

import { ListPlugin } from '../plugin';
import { useStyles } from './style';

export interface ReactListPluginProps {
  className?: string;
}

export const ReactListPlugin: FC<ReactListPluginProps> = () => {
  const [editor] = useLexicalComposerContext();
  const { styles } = useStyles();

  useLayoutEffect(() => {
    // 优先注册依赖插件
    editor.registerPlugin(MarkdownPlugin);
    editor.registerPlugin(ListPlugin, {
      className: styles,
    });
  }, []);

  return null;
};
