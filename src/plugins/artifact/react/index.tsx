'use client';

import type { FC } from 'react';
import { useLayoutEffect } from 'react';

import { useLexicalComposerContext } from '@/editor-kernel/react/react-context';
import { MarkdownPlugin } from '@/plugins/markdown/plugin';

import { ArtifactPlugin } from '../plugin';
import ArtifactView from './ArtifactView';
import { artifactStyles } from './style';
import type { ReactArtifactPluginProps } from './type';

export const ReactArtifactPlugin: FC<ReactArtifactPluginProps> = ({
  allowScripts = false,
  className,
  labels,
  previewHeight = 420,
}) => {
  const [editor] = useLexicalComposerContext();

  useLayoutEffect(() => {
    // Artifact's fenced Markdown reader/writer is part of the core plugin
    // contract. Registering the service here also keeps the React plugin
    // usable when the host disables the editor-wide Markdown auto-formatting.
    editor.registerPlugin(MarkdownPlugin);
    editor.registerPlugin(ArtifactPlugin, {
      decorator: (node, lexicalEditor) => (
        <ArtifactView
          allowScripts={allowScripts}
          className={className}
          editor={lexicalEditor}
          labels={labels}
          node={node}
          previewHeight={previewHeight}
        />
      ),
      theme: artifactStyles,
    });
  }, [allowScripts, className, editor, labels, previewHeight]);

  return null;
};

ReactArtifactPlugin.displayName = 'ReactArtifactPlugin';

export type { ArtifactLabels, ReactArtifactPluginProps } from './type';
export default ReactArtifactPlugin;
