'use client';

import { type FC, useLayoutEffect } from 'react';

import { useLexicalComposerContext } from '@/editor-kernel/react';

import { LitexmlPlugin } from '../plugin';

export const ReactLiteXmlPlugin: FC<void> = () => {
  const [editor] = useLexicalComposerContext();

  useLayoutEffect(() => {
    editor.registerPlugin(LitexmlPlugin);
  }, [editor]);

  return null;
};

ReactLiteXmlPlugin.displayName = 'ReactLiteXmlPlugin';

export default ReactLiteXmlPlugin;
