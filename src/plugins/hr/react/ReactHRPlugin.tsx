'use client';

import type { FC } from 'react';
import { useLayoutEffect } from 'react';

import { useLexicalComposerContext } from '@/editor-kernel/react/react-context';
import { MarkdownPlugin } from '@/plugins/markdown';

import { HRPlugin } from '../plugin';
import HRNode from './components/HRNode';
import { ReactHRPluginProps } from './type';

const ReactHRPlugin: FC<ReactHRPluginProps> = ({ className }) => {
  const [editor] = useLexicalComposerContext();

  useLayoutEffect(() => {
    editor.registerPlugin(MarkdownPlugin);
    editor.registerPlugin(HRPlugin, {
      decorator(node, editor) {
        return <HRNode className={className} editor={editor} node={node} />;
      },
    });
  }, []);

  return null;
};

ReactHRPlugin.displayName = 'ReactHRPlugin';

export default ReactHRPlugin;
