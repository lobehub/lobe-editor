'use client';

import { type FC, useLayoutEffect } from 'react';

import { useLexicalComposerContext } from '@/editor-kernel/react';

import { LitexmlPlugin } from '../plugin';
import ReactDiffNodeToolbar from './DiffNodeToolbar';

export const ReactLiteXmlPlugin: FC<void> = () => {
  const [editor] = useLexicalComposerContext();

  useLayoutEffect(() => {
    editor.registerPlugin(LitexmlPlugin, {
      decorator: (node, editor) => <ReactDiffNodeToolbar editor={editor} node={node} />,
    });
  }, [editor]);

  return null;
};

ReactLiteXmlPlugin.displayName = 'ReactLiteXmlPlugin';

export default ReactLiteXmlPlugin;
