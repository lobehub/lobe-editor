'use client';

import { type FC, useLayoutEffect } from 'react';

import { useLexicalComposerContext } from '@/editor-kernel/react/react-context';
import { UploadPlugin } from '@/plugins/upload';

import { ImagePlugin } from '../plugin';
import Image from './components/Image';
import { styles } from './style';
import { ReactImagePluginProps } from './type';

const getImageWidth = (file: File): Promise<number> =>
  new Promise((resolve) => {
    const reader = new FileReader();
    reader.addEventListener('load', (event) => {
      const img = new window.Image();
      img.addEventListener('load', () => {
        resolve(img.naturalWidth);
      });
      img.addEventListener('error', () => {
        resolve(800);
      });
      img.src = event.target?.result as string;
    });
    reader.addEventListener('error', () => {
      resolve(800);
    });
    reader.readAsDataURL(file);
  });

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
  onPickFile,
}) => {
  const [editor] = useLexicalComposerContext();

  useLayoutEffect(() => {
    editor.registerPlugin(UploadPlugin);
    editor.registerPlugin(ImagePlugin, {
      defaultBlockImage,
      getImageWidth,
      handleRehost,
      handleUpload: handleUpload || defaultUpload,
      needRehost,
      renderImage: (node) => {
        return (
          <Image
            className={className}
            handleUpload={handleUpload || defaultUpload}
            node={node}
            onPickFile={onPickFile}
          />
        );
      },
      theme: theme || styles,
    });
  }, []);

  return null;
};

ReactImagePlugin.displayName = 'ReactImagePlugin';

export default ReactImagePlugin;
