import type { FC } from 'react';
import { useLayoutEffect } from 'react';

import { useLexicalComposerContext } from '@/editor-kernel/react/react-context';
import { UploadPlugin } from '@/plugins/upload';

import { ImagePlugin } from '../plugin';
import { Image } from './image';

export interface ReactImagePluginProps {
  className?: string;
}

export const ReactImagePlugin: FC<ReactImagePluginProps> = (props) => {
  const [editor] = useLexicalComposerContext();

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
        return <Image className={props.className} node={node} />;
      },
    });
  }, []);

  return null;
};
