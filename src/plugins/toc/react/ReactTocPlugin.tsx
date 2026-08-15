'use client';

import type { FC } from 'react';
import { useInsertionEffect } from 'react';

import { useLexicalComposerContext } from '@/editor-kernel/react/react-context';
import type { IEditor } from '@/types';

import { TocPlugin } from '../plugin';
import type { ReactTocPluginProps } from './type';

const HeadlessTocPlugin: FC<ReactTocPluginProps & { editor: IEditor }> = ({
  editor,
  maxDepth = 6,
  minDepth = 1,
}) => {
  useInsertionEffect(() => {
    editor.registerPlugin(TocPlugin, { maxDepth, minDepth });
  }, [editor, maxDepth, minDepth]);

  return null;
};

const TocPluginWithContext: FC<Omit<ReactTocPluginProps, 'editor'>> = (props) => {
  const [editor] = useLexicalComposerContext();

  return <HeadlessTocPlugin {...props} editor={editor} />;
};

const ReactTocPlugin: FC<ReactTocPluginProps> = ({ editor, ...props }) => {
  if (editor) {
    return <HeadlessTocPlugin {...props} editor={editor} />;
  }

  return <TocPluginWithContext {...props} />;
};

ReactTocPlugin.displayName = 'ReactTocPlugin';

export default ReactTocPlugin;
