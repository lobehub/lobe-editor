'use client';

import {
  CONTENT_BLOCKS_DATA_TYPE,
  type ContentBlock,
  ContentBlocksPlugin,
  type IEditor,
  type MediaLists,
  ReactFilePlugin,
  ReactImagePlugin,
  extractMediaLists,
} from '@lobehub/editor';
import { Editor, useEditor } from '@lobehub/editor/react';
import { Highlighter, ToastHost } from '@lobehub/ui';
import { Accordion } from '@lobehub/ui/base-ui';
import { debounce } from 'es-toolkit';
import { type FC, useLayoutEffect, useMemo, useState } from 'react';

import { useLexicalComposerContext } from '@/editor-kernel/react';

import content from './data.json';

const ReactContentBlocksPlugin: FC = () => {
  const [editor] = useLexicalComposerContext();
  useLayoutEffect(() => {
    editor.registerPlugin(ContentBlocksPlugin);
  }, [editor]);
  return null;
};

const Panel: FC<{ value: unknown }> = ({ value }) => (
  <Highlighter language="json" style={{ fontSize: 12, padding: 16 }} variant="borderless">
    {JSON.stringify(value, null, 2)}
  </Highlighter>
);

const emptyMedia: MediaLists = { fileList: [], imageList: [] };

const fileUpload = async (file: File): Promise<{ url: string }> =>
  new Promise((resolve) => {
    setTimeout(() => resolve({ url: URL.createObjectURL(file) }), 600);
  });

export default () => {
  const editor = useEditor();
  const [blocks, setBlocks] = useState<ContentBlock[]>([]);
  const [media, setMedia] = useState<MediaLists>(emptyMedia);

  const handleChange = useMemo(
    () =>
      debounce((ed: IEditor) => {
        try {
          const next = ed.getDocument(CONTENT_BLOCKS_DATA_TYPE) as unknown as ContentBlock[];
          setBlocks(next ?? []);
          setMedia(extractMediaLists(next ?? []));
        } catch (error) {
          console.error('[content-blocks demo]', error);
        }
      }, 150),
    [],
  );

  return (
    <>
      <ToastHost />
      <Accordion
        defaultValue={['editor', 'blocks', 'media']}
        items={[
          {
            children: (
              <Editor
                content={content}
                editor={editor}
                onInit={handleChange}
                onTextChange={handleChange}
                placeholder="Edit text · drop images · attach files…"
                plugins={[
                  ReactContentBlocksPlugin,
                  Editor.withProps(ReactImagePlugin, { defaultBlockImage: true }),
                  Editor.withProps(ReactFilePlugin, { handleUpload: fileUpload }),
                ]}
                style={{ padding: 16 }}
                type="json"
              />
            ),
            key: 'editor',
            title: 'Playground',
          },
          {
            children: <Panel value={blocks} />,
            key: 'blocks',
            title: `content-blocks (${blocks.length})`,
          },
          {
            children: <Panel value={media} />,
            key: 'media',
            title: `extractMediaLists → ${media.imageList.length} image · ${media.fileList.length} file`,
          },
        ]}
        style={{ border: 'none', borderRadius: 0 }}
        styles={{ content: { padding: 0 } }}
        variant="outlined"
      />
    </>
  );
};
