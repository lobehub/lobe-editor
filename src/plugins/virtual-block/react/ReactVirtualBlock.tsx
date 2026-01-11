'use client';

import { type FC, useLayoutEffect } from 'react';

import { useLexicalComposerContext } from '@/editor-kernel/react/react-context';

import { VirtualBlockPlugin } from '../plugin';

const ReactVirtualBlockPlugin: FC = () => {
  const [editor] = useLexicalComposerContext();

  useLayoutEffect(() => {
    editor.registerPlugin(VirtualBlockPlugin);
  }, []);

  return null;
};

ReactVirtualBlockPlugin.displayName = 'ReactVirtualBlockPlugin';

export default ReactVirtualBlockPlugin;
