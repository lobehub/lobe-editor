'use client';

import type { FC } from 'react';

import { useLexicalComposerContext } from '@/editor-kernel/react/react-context';

import TocView from './TocView';
import type { ReactTocPluginProps } from './type';

const TocViewWithContext: FC<Omit<ReactTocPluginProps, 'editor'>> = (props) => {
  const [editor] = useLexicalComposerContext();

  return <TocView {...props} editor={editor} />;
};

const ReactTocPlugin: FC<ReactTocPluginProps> = ({ editor, ...props }) => {
  if (editor) {
    return <TocView {...props} editor={editor} />;
  }

  return <TocViewWithContext {...props} />;
};

ReactTocPlugin.displayName = 'ReactTocPlugin';

export default ReactTocPlugin;
