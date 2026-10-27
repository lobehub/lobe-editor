'use client';

import { type FC, useLayoutEffect } from 'react';

import { useLexicalComposerContext } from '@/editor-kernel/react/react-context';
import { UploadPlugin } from '@/plugins/upload';

import { FilePlugin } from '../plugin';
import ReactFile from './components/ReactFile';
import { styles } from './style';
import type { ReactFilePluginProps } from './type';

const ReactFilePlugin: FC<ReactFilePluginProps> = ({
  className,
  locale,
  handleUpload,
  markdownWriter,
  onDownload,
  onPreview,
  theme,
}) => {
  const [editor] = useLexicalComposerContext();

  useLayoutEffect(() => {
    if (locale) {
      editor.registerLocale(locale);
    }
    editor.registerPlugin(UploadPlugin);
    editor.registerPlugin(FilePlugin, {
      decorator: (node, editor) => {
        return (
          <ReactFile
            className={className}
            editor={editor}
            node={node}
            onDownload={onDownload}
            onPreview={onPreview}
          />
        );
      },
      handleUpload: async (file) => {
        if (handleUpload) {
          return handleUpload(file);
        }
        throw new Error('No upload handler provided');
      },
      markdownWriter,
      theme: theme || styles,
    });
  }, [editor]);

  return null;
};

ReactFilePlugin.displayName = 'ReactFilePlugin';

export default ReactFilePlugin;
