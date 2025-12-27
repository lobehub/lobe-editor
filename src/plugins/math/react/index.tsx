'use client';

import { type FC, useLayoutEffect } from 'react';

import { useLexicalComposerContext } from '@/editor-kernel/react/react-context';
import { MarkdownPlugin } from '@/plugins/markdown/plugin';

import { MathPlugin } from '../plugin';
import MathEdit from './components/MathEditor';
import MathInline from './components/MathInline';
import { styles } from './style';
import { ReactMathPluginProps } from './type';

export const ReactMathPlugin: FC<ReactMathPluginProps> = ({ className, renderComp, theme }) => {
  const [editor] = useLexicalComposerContext();

  useLayoutEffect(() => {
    editor.registerPlugin(MarkdownPlugin);
    editor.registerPlugin(MathPlugin, {
      decorator: (node, editor) => {
        return <MathInline className={className} editor={editor} node={node} />;
      },
      theme: theme || styles,
    });
  }, [editor, className, theme, styles]);

  return <MathEdit renderComp={renderComp} />;
};

ReactMathPlugin.displayName = 'ReactMathPlugin';
