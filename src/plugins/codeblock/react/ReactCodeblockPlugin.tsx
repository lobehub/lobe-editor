import type { FC } from 'react';
import { useLayoutEffect } from 'react';

import { useLexicalComposerContext } from '@/editor-kernel/react/react-context';
import { MarkdownPlugin } from '@/plugins/markdown';

import { CodeblockPlugin, CodeblockPluginOptions } from '../plugin';

import './style.less';

export interface ReactCodeblockPluginProps extends CodeblockPluginOptions {
  className?: string;
}

export const ReactCodeblockPlugin: FC<ReactCodeblockPluginProps> = ({ theme }) => {
  const [editor] = useLexicalComposerContext();

  useLayoutEffect(() => {
    editor.registerPlugin(MarkdownPlugin);
    editor.registerPlugin(CodeblockPlugin, {
      theme,
    });
  }, []);

  return null;
};
