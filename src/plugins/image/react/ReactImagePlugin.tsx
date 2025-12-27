'use client';

import { type FC, useLayoutEffect } from 'react';

import { useLexicalComposerContext } from '@/editor-kernel/react/react-context';
import { UploadPlugin } from '@/plugins/upload';

import { ImagePlugin } from '../plugin';
import Image from './components/Image';
import { styles } from './style';
import { ReactImagePluginProps } from './type';

const defaultUpload = (file: File) => {
  return new Promise<{ url: string }>((resolve) => {
    setTimeout(() => {
      resolve({ url: URL.createObjectURL(file) });
    }, 1000);
  });
};

const ReactImagePlugin: FC<ReactImagePluginProps> = ({
  theme,
  className,
  defaultBlockImage,
  handleUpload,
  needRehost,
  handleRehost,
}) => {
  const [editor] = useLexicalComposerContext();

  useLayoutEffect(() => {
    editor.registerPlugin(UploadPlugin);
    editor.registerPlugin(ImagePlugin, {
      defaultBlockImage,
      handleRehost,
      handleUpload: handleUpload || defaultUpload,
      needRehost,
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
