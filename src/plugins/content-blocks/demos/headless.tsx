'use client';

import {
  CONTENT_BLOCKS_DATA_TYPE,
  type ContentBlock,
  ContentBlocksPlugin,
  FilePlugin,
  ImagePlugin,
  type MediaLists,
  extractMediaLists,
} from '@lobehub/editor';
import { DEFAULT_HEADLESS_EDITOR_PLUGINS, createHeadlessEditor } from '@lobehub/editor/headless';
import { CodeEditor, Collapse, Highlighter } from '@lobehub/ui';
import { debounce } from 'es-toolkit';
import { useMemo, useState } from 'react';

import sample from './data.json';

const noopUpload = async (): Promise<{ url: string }> => ({ url: '' });

const buildHeadless = () =>
  createHeadlessEditor({
    additionalPlugins: [
      [ImagePlugin, { handleUpload: noopUpload, renderImage: () => null }],
      [FilePlugin, { decorator: () => null, handleUpload: noopUpload }],
      ContentBlocksPlugin,
    ],
    plugins: DEFAULT_HEADLESS_EDITOR_PLUGINS,
  });

interface Result {
  blocks: ContentBlock[];
  error?: string;
  media: MediaLists;
}

const extract = (jsonText: string): Result => {
  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonText);
  } catch (error) {
    return {
      blocks: [],
      error: `Invalid JSON: ${(error as Error).message}`,
      media: { fileList: [], imageList: [] },
    };
  }

  const headless = buildHeadless();
  try {
    headless.hydrate({ content: parsed, type: 'json' });
    const blocks = headless.kernel.getDocument(
      CONTENT_BLOCKS_DATA_TYPE,
    ) as unknown as ContentBlock[];
    return { blocks: blocks ?? [], media: extractMediaLists(blocks ?? []) };
  } catch (error) {
    return {
      blocks: [],
      error: (error as Error).message,
      media: { fileList: [], imageList: [] },
    };
  } finally {
    headless.destroy();
  }
};

const initialInput = JSON.stringify(sample, null, 2);

export default () => {
  const [input, setInput] = useState(initialInput);
  const [result, setResult] = useState<Result>(() => extract(initialInput));

  const debouncedExtract = useMemo(
    () => debounce((value: string) => setResult(extract(value)), 200),
    [],
  );

  const handleChange = (next: string) => {
    setInput(next);
    debouncedExtract(next);
  };

  return (
    <Collapse
      defaultActiveKey={['input', 'blocks', 'media']}
      items={[
        {
          children: (
            <CodeEditor
              language="json"
              onValueChange={handleChange}
              style={{ fontSize: 12 }}
              value={input}
              variant="borderless"
            />
          ),
          key: 'input',
          label: 'Editor JSON (input)',
        },
        {
          children: (
            <Highlighter language="json" style={{ fontSize: 12, padding: 16 }} variant="borderless">
              {result.error ? `// ${result.error}` : JSON.stringify(result.blocks, null, 2)}
            </Highlighter>
          ),
          key: 'blocks',
          label: `content-blocks (${result.blocks.length})`,
        },
        {
          children: (
            <Highlighter language="json" style={{ fontSize: 12, padding: 16 }} variant="borderless">
              {JSON.stringify(result.media, null, 2)}
            </Highlighter>
          ),
          key: 'media',
          label: `extractMediaLists → ${result.media.imageList.length} image · ${result.media.fileList.length} file`,
        },
      ]}
      padding={{ body: 0 }}
      style={{ border: 'none', borderRadius: 0, width: '100%' }}
      variant="outlined"
    />
  );
};
