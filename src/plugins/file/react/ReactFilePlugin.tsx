'use client';

import type { FC } from 'react';
import { useLayoutEffect } from 'react';

import { useLexicalComposerContext } from '@/editor-kernel/react/react-context';
import { UploadPlugin } from '@/plugins/upload';

import { FilePlugin } from '../plugin';
import { ReactFile } from './components/ReactFile';
import { useStyles } from './style';
import { ReactFilePluginProps } from './type';

const ReactFilePlugin: FC<ReactFilePluginProps> = (props) => {
  const [editor] = useLexicalComposerContext();
  const { styles } = useStyles();

  useLayoutEffect(() => {
    editor.registerI18n(
      props.i18n || {
        'file.error': 'Error: {message}',
        'file.uploading': 'Uploading file...',
      },
    );
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
      markdownWriter: props.markdownWriter,
      theme: props.theme || { file: styles.editor_file },
    });
  }, [editor]);

  return null;
};

ReactFilePlugin.displayName = 'ReactFilePlugin';

export default ReactFilePlugin;
