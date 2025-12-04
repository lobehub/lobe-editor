'use client';

import { type FC, useLayoutEffect } from 'react';

import { useLexicalComposerContext } from '@/editor-kernel/react/react-context';

import { CodemirrorPlugin } from '../plugin';
import ReactCodemirrorNode from './CodemirrorNode';
import { ReactCodemirrorPluginProps } from './type';

const ReactCodemirrorPlugin: FC<ReactCodemirrorPluginProps> = ({ className }) => {
  const [editor] = useLexicalComposerContext();

  useLayoutEffect(() => {
    editor.registerPlugin(CodemirrorPlugin, {
      decorator(node, editor) {
        return <ReactCodemirrorNode className={className} editor={editor} node={node} />;
      },
      theme: className,
    });
  }, [editor, className]);

  return null;
};

ReactCodemirrorPlugin.displayName = 'ReactCodemirrorPlugin';

export default ReactCodemirrorPlugin;
