import type { FC } from 'react';
import { useLayoutEffect } from 'react';

import { useLexicalComposerContext } from '@/editor-kernel/react/react-context';
import { UploadPlugin } from '@/plugins/upload';

import { FilePlugin } from '../plugin';
import { ReactFile } from './ReactFile';
import { useStyles } from './style';

export interface ReactFilePluginProps {
  className?: string;
  handleUpload: (file: File) => Promise<{ url: string }>;
  theme?: {
    file?: string;
  };
}

export const ReactFilePlugin: FC<ReactFilePluginProps> = (props) => {
  const [editor] = useLexicalComposerContext();
  const { styles } = useStyles();

  useLayoutEffect(() => {
    editor.registerPlugin(UploadPlugin);
    editor.registerPlugin(FilePlugin, {
      decorator: (node, editor) => {
        return <ReactFile className={props.className} editor={editor} node={node} />;
      },
      handleUpload: async (file) => {
        if (props.handleUpload) {
          return props.handleUpload(file);
        }
        throw new Error('No upload handler provided');
      },
      theme: props.theme || { file: styles.editor_file },
    });
  }, [editor]);

  return null;
};
