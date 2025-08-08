import type { FC } from 'react';
import { useLayoutEffect } from 'react';
import { ListPlugin } from '../plugin';
import { MarkdownPlugin } from '@/plugins/markdown';
import { useLexicalComposerContext } from '@/editor-kernel/react/react-context';

import './index.less';

export interface ReactListPluginProps {
  className?: string;
}

export const ReactListPlugin: FC<ReactListPluginProps> = () => {
  const [editor] = useLexicalComposerContext();

  useLayoutEffect(() => {
    // 优先注册依赖插件
    editor.registerPlugin(MarkdownPlugin);
    editor.registerPlugin(ListPlugin);
  }, []);

  return null;
};
