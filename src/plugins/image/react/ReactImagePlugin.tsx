import type { FC } from 'react';
import { useLayoutEffect } from 'react';

import { useLexicalComposerContext } from '@/editor-kernel/react/react-context';
import { UploadPlugin } from '@/plugins/upload';

import { ImagePlugin } from '../plugin';
import { Image } from './image';
import { useStyles } from './style';

export interface ReactImagePluginProps {
  className?: string;
  theme?: {
    image?: string;
  };
}

export const ReactImagePlugin: FC<ReactImagePluginProps> = (props) => {
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
        return <Image className={props.className} node={node} />;
      },
      theme: props.theme || styles,
    });
  }, []);

  return null;
};
