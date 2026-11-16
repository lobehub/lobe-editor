'use client';

import { cx } from '@lobehub/ui';
import { type FC, useLayoutEffect } from 'react';

import { useLexicalComposerContext } from '@/editor-kernel/react/react-context';
import { INodePlugin } from '@/plugins/inode';
import { MarkdownPlugin } from '@/plugins/markdown/plugin';

import { FootnotePlugin } from '../plugin';
import FootnoteReference from './FootnoteReference';
import { styles } from './style';
import type { ReactFootnotePluginProps } from './type';

const ReactFootnotePlugin: FC<ReactFootnotePluginProps> = ({ className }) => {
  const [editor] = useLexicalComposerContext();

  useLayoutEffect(() => {
    editor.registerPlugin(INodePlugin);
    editor.registerPlugin(MarkdownPlugin);
    editor.registerPlugin(FootnotePlugin, {
      decorator: (node) => <FootnoteReference node={node} />,
      theme: {
        footnoteDefinition: styles.definition,
        footnoteSection: cx(styles.section, className),
      },
    });
  }, [className, editor]);

  return null;
};

ReactFootnotePlugin.displayName = 'ReactFootnotePlugin';

export default ReactFootnotePlugin;
