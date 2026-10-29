'use client';

import { type FC, useLayoutEffect } from 'react';

import { useLexicalComposerContext } from '@/editor-kernel/react/react-context';
import { UploadPlugin } from '@/plugins/upload';

import { VideoPlugin } from '../plugin';
import VideoBlock from './components/VideoBlock';
import { styles } from './style';
import type { ReactVideoPluginProps } from './type';

const ReactVideoPlugin: FC<ReactVideoPluginProps> = ({
  className,
  handleUpload,
  onPickFile,
  theme,
}) => {
  const [editor] = useLexicalComposerContext();

  useLayoutEffect(() => {
    editor.registerPlugin(UploadPlugin);
    editor.registerPlugin(VideoPlugin, {
      decorator: (node) => (
        <VideoBlock
          className={className}
          handleUpload={handleUpload}
          node={node}
          onPickFile={onPickFile}
        />
      ),
      handleUpload,
      theme: theme || styles,
    });
  }, [editor]);

  return null;
};

ReactVideoPlugin.displayName = 'ReactVideoPlugin';

export default ReactVideoPlugin;
