'use client';

import { type FC, useLayoutEffect } from 'react';

import { useLexicalComposerContext } from '@/editor-kernel/react/react-context';
import { UploadPlugin } from '@/plugins/upload';

import { FilePlugin } from '../plugin';
import ReactFile from './components/ReactFile';
import { useStyles } from './style';
import { ReactFilePluginProps } from './type';

const ReactFilePlugin: FC<ReactFilePluginProps> = ({
  className,
  locale,
  handleUpload,
  markdownWriter,
  theme,
}) => {
  const [editor] = useLexicalComposerContext();
  const { styles } = useStyles();

  useLayoutEffect(() => {
    if (locale) {
      editor.registerLocale(locale);
    }
    editor.registerPlugin(UploadPlugin);
    editor.registerPlugin(FilePlugin, {
      decorator: (node, editor) => {
        return <ReactFile className={className} editor={editor} node={node} />;
      },
      handleUpload: async (file) => {
        if (handleUpload) {
          return handleUpload(file);
        }
        console.error('No upload handler provided');
        return { url: '' };
      },
      markdownWriter: markdownWriter,
      theme: theme || styles,
    });
  }, [editor]);

  return null;
};

ReactFilePlugin.displayName = 'ReactFilePlugin';

export default ReactFilePlugin;
