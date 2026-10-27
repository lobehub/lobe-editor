'use client';

import { type FC, useLayoutEffect } from 'react';

import { useLexicalComposerContext } from '@/editor-kernel/react/react-context';
import { MarkdownPlugin } from '@/plugins/markdown/plugin';

import { ChartPlugin } from '../plugin';
import ChartBlock from './components/ChartBlock';
import type { ReactChartPluginProps } from './type';

const ReactChartPlugin: FC<ReactChartPluginProps> = ({ className, height = 280 }) => {
  const [editor] = useLexicalComposerContext();

  useLayoutEffect(() => {
    editor.registerPlugin(MarkdownPlugin);
    editor.registerPlugin(ChartPlugin, {
      decorator(node, editor) {
        return <ChartBlock className={className} editor={editor} height={height} node={node} />;
      },
      theme: className,
    });
  }, []);

  return null;
};

ReactChartPlugin.displayName = 'ReactChartPlugin';

export default ReactChartPlugin;
