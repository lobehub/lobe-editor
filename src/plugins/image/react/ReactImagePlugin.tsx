'use client';

import { type FC, useLayoutEffect } from 'react';

import { useLexicalComposerContext } from '@/editor-kernel/react/react-context';
import { UploadPlugin } from '@/plugins/upload';

import { ImagePlugin } from '../plugin';
import Image from './components/Image';
import { useStyles } from './style';
import { ReactImagePluginProps } from './type';

const ReactImagePlugin: FC<ReactImagePluginProps> = ({ theme, className }) => {
  const [editor] = useLexicalComposerContext();
  const { styles } = useStyles();

  useLayoutEffect(() => {
    editor.registerPlugin(UploadPlugin);
    editor.registerPlugin(ImagePlugin, {
      handleUpload(file) {
        return new Promise((resolve) => {
          setTimeout(() => {
            resolve({ url: URL.createObjectURL(file) });
          }, 1000);
        });
      },
      renderImage: (node) => {
        return <Image className={className} node={node} />;
      },
      theme: theme || styles,
    });
  }, []);

  return null;
};

ReactImagePlugin.displayName = 'ReactImagePlugin';

export default ReactImagePlugin;
