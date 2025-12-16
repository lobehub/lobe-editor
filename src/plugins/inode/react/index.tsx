'use client';

import { type FC, useLayoutEffect } from 'react';

import { useLexicalComposerContext } from '@/editor-kernel/react';

import { INodePlugin } from '../plugin';

export const ReactNodePlugin: FC<void> = () => {
  const [editor] = useLexicalComposerContext();

  useLayoutEffect(() => {
    editor.registerPlugin(INodePlugin);
  }, [editor]);

  return null;
};

ReactNodePlugin.displayName = 'ReactNodePlugin';

export default ReactNodePlugin;
