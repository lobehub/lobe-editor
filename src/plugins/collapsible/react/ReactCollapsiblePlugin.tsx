'use client';

import { type FC, useLayoutEffect } from 'react';

import { useLexicalComposerContext } from '@/editor-kernel/react/react-context';
import { MarkdownPlugin } from '@/plugins/markdown/plugin';

import { CollapsiblePlugin } from '../plugin';
import type { ReactCollapsiblePluginProps } from './type';

const ReactCollapsiblePlugin: FC<ReactCollapsiblePluginProps> = ({ className }) => {
  const [editor] = useLexicalComposerContext();

  useLayoutEffect(() => {
    editor.registerPlugin(MarkdownPlugin);
    editor.registerPlugin(CollapsiblePlugin, {
      theme: {
        collapsible: className,
      },
    });
  }, [className, editor]);

  return null;
};

ReactCollapsiblePlugin.displayName = 'ReactCollapsiblePlugin';

export default ReactCollapsiblePlugin;
