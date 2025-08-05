import type { FC } from 'react';
import { useLayoutEffect } from 'react';

import { useLexicalComposerContext } from '@/editor-kernel/react/react-context';
import { MarkdownPlugin } from '@/plugins/markdown';

import { CodeblockPlugin } from '../plugin';

export interface ReactCodeblockPluginProps {
  className?: string;
}

export const ReactCodeblockPlugin: FC<ReactCodeblockPluginProps> = () => {
  const [editor] = useLexicalComposerContext();

  useLayoutEffect(() => {
    console.info('ReactCodeblockPlugin: Initializing Codeblock Plugin');
    editor.registerPlugin(MarkdownPlugin);
    editor.registerPlugin(CodeblockPlugin);
  }, []);

  return null;
};
