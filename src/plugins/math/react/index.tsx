'use client';

import { type FC, useLayoutEffect } from 'react';

import { useLexicalComposerContext } from '@/editor-kernel/react/react-context';
import { MarkdownPlugin } from '@/plugins/markdown';

import { MathPlugin } from '../plugin';
import MathEdit from './component/MathEditor';
import MathInline from './component/MathInline';
import { useStyles } from './style';
import { ReactMathPluginProps } from './type';

export const ReactMathPlugin: FC<ReactMathPluginProps> = ({ className, theme }) => {
  const [editor] = useLexicalComposerContext();
  const { styles } = useStyles();

  useLayoutEffect(() => {
    editor.registerPlugin(MarkdownPlugin);
    editor.registerPlugin(MathPlugin, {
      decorator: (node, editor) => {
        return <MathInline className={className} editor={editor} node={node} />;
      },
      theme: theme || styles,
    });
  }, [editor]);

  return <MathEdit />;
};

ReactMathPlugin.displayName = 'ReactMathPlugin';
