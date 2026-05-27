import { beforeEach, describe, expect, it } from 'vitest';

import Editor from '@/editor-kernel';
import type { IEditor } from '@/types';

import { CommonPlugin } from '../../../common';
import { FilePlugin } from '../../../file';
import { ImagePlugin } from '../../../image';
import { MarkdownPlugin } from '../../../markdown/plugin';
import { IMarkdownShortCutService } from '../../../markdown/service/shortcut';
import { ContentBlocksPlugin } from '../../plugin';
import { CONTENT_BLOCKS_DATA_TYPE, type ContentBlock } from '../../types';
import { extractContentBlocks } from '../extract';

const buildKernel = (): IEditor => {
  const kernel = Editor.createEditor().registerPlugins([
    CommonPlugin,
    MarkdownPlugin,
    [ImagePlugin, { renderImage: () => null }],
    [FilePlugin, { decorator: () => null, handleUpload: async () => ({ url: '' }) }],
    ContentBlocksPlugin,
  ]);
  kernel.initNodeEditor();
  return kernel;
};

const seed = (kernel: IEditor, root: Record<string, unknown>) => {
  kernel.setDocument('json', { root }, { keepId: true });
};

const getBlocks = (kernel: IEditor): ContentBlock[] =>
  kernel.getDocument(CONTENT_BLOCKS_DATA_TYPE) as unknown as ContentBlock[];

const paragraphRoot = (children: Record<string, unknown>[]) => ({
  children,
  direction: 'ltr',
  format: '',
  indent: 0,
  type: 'root',
  version: 1,
});

const paragraph = (children: Record<string, unknown>[]) => ({
  children,
  direction: 'ltr',
  format: '',
  indent: 0,
  textFormat: 0,
  textStyle: '',
  type: 'paragraph',
  version: 1,
});

const textNode = (text: string) => ({
  detail: 0,
  format: 0,
  mode: 'normal',
  style: '',
  text,
  type: 'text',
  version: 1,
});

const inlineImage = (
  attrs: Partial<{
    altText: string;
    height: number;
    maxWidth: number;
    src: string;
    status: 'uploaded' | 'loading' | 'error';
    width: number;
  }>,
) => ({
  altText: '',
  height: 0,
  maxWidth: 500,
  src: '',
  status: 'uploaded',
  type: 'image',
  version: 1,
  width: 0,
  ...attrs,
});

const blockImage = (
  attrs: Partial<{
    altText: string;
    height: number;
    maxWidth: number;
    src: string;
    status: 'uploaded' | 'loading' | 'error';
    width: number;
  }>,
) => ({
  altText: '',
  height: 0,
  maxWidth: 500,
  src: '',
  status: 'uploaded',
  type: 'block-image',
  version: 1,
  width: 0,
  ...attrs,
});

const fileNode = (
  attrs: Partial<{
    fileUrl: string;
    message: string;
    name: string;
    size: number;
    status: 'pending' | 'uploaded' | 'error';
  }>,
) => ({
  name: 'unknown',
  status: 'pending',
  type: 'file',
  version: 1,
  ...attrs,
});

describe('extractContentBlocks', () => {
  let kernel: IEditor;

  beforeEach(() => {
    kernel = buildKernel();
  });

  it('returns an empty array for an empty editor', () => {
    seed(kernel, paragraphRoot([paragraph([])]));
    expect(getBlocks(kernel)).toEqual([]);
  });

  it('returns a single text block for plain paragraphs', () => {
    seed(kernel, paragraphRoot([paragraph([textNode('Hello world')])]));
    const blocks = getBlocks(kernel);
    expect(blocks).toEqual([{ text: 'Hello world', type: 'text' }]);
  });

  it('emits a stand-alone image block for a root-level block image', () => {
    seed(kernel, paragraphRoot([blockImage({ altText: 'logo', src: 'https://cdn/logo.png' })]));
    expect(getBlocks(kernel)).toEqual([
      { alt: 'logo', type: 'image', url: 'https://cdn/logo.png' },
    ]);
  });

  it('splits a paragraph around an inline image', () => {
    seed(
      kernel,
      paragraphRoot([
        paragraph([
          textNode('before '),
          inlineImage({ altText: 'pic', src: 'https://cdn/a.png' }),
          textNode(' after'),
        ]),
      ]),
    );
    const blocks = getBlocks(kernel);
    expect(blocks).toHaveLength(3);
    expect(blocks[0]).toEqual({ text: 'before', type: 'text' });
    expect(blocks[1]).toEqual({ alt: 'pic', type: 'image', url: 'https://cdn/a.png' });
    expect(blocks[2]).toEqual({ text: 'after', type: 'text' });
  });

  it('emits image and file blocks in document order', () => {
    seed(
      kernel,
      paragraphRoot([
        paragraph([textNode('hi')]),
        blockImage({ altText: 'a', src: 'https://cdn/a.png' }),
        fileNode({
          fileUrl: 'https://cdn/x.pdf',
          name: 'x.pdf',
          size: 1234,
          status: 'uploaded',
        }),
        paragraph([textNode('end')]),
      ]),
    );
    const blocks = getBlocks(kernel);
    expect(blocks.map((b) => b.type)).toEqual(['text', 'image', 'file', 'text']);
    expect(blocks[2]).toEqual({
      name: 'x.pdf',
      size: 1234,
      type: 'file',
      url: 'https://cdn/x.pdf',
    });
  });

  it('drops non-uploaded image and adds a loading placeholder', () => {
    seed(
      kernel,
      paragraphRoot([
        paragraph([textNode('before '), inlineImage({ status: 'loading' }), textNode(' after')]),
      ]),
    );
    const blocks = getBlocks(kernel);
    expect(blocks).toHaveLength(1);
    expect(blocks[0].type).toBe('text');
    const text = (blocks[0] as { text: string }).text;
    expect(text).toContain('before');
    expect(text).toContain('[image uploading...]');
    expect(text).toContain('after');
  });

  it('renders error placeholder with message', () => {
    seed(kernel, paragraphRoot([blockImage({ status: 'error' })]));
    const blocks = getBlocks(kernel);
    expect(blocks).toHaveLength(1);
    expect((blocks[0] as { text: string }).text).toContain('[image upload failed]');
  });

  it('drops non-uploaded image silently when placeholder is disabled', () => {
    seed(
      kernel,
      paragraphRoot([
        paragraph([textNode('a'), inlineImage({ status: 'loading' }), textNode('b')]),
      ]),
    );
    const editor = kernel.getLexicalEditor()!;
    const service = kernel.requireService(IMarkdownShortCutService)!;
    const blocks: ContentBlock[] = extractContentBlocks(editor, service, {
      emitPlaceholderForUnuploaded: false,
    });
    // The dropped image leaves two adjacent text segments which then merge.
    expect(blocks).toEqual([{ text: 'a\n\nb', type: 'text' }]);
  });

  it('preserves width and height when set', () => {
    seed(
      kernel,
      paragraphRoot([
        blockImage({
          altText: 'sized',
          height: 200,
          src: 'https://cdn/sized.png',
          width: 400,
        }),
      ]),
    );
    expect(getBlocks(kernel)).toEqual([
      {
        alt: 'sized',
        height: 200,
        type: 'image',
        url: 'https://cdn/sized.png',
        width: 400,
      },
    ]);
  });

  it('omits width/height fields when they are 0 (inherit)', () => {
    seed(kernel, paragraphRoot([blockImage({ altText: 'a', src: 'https://cdn/a.png' })]));
    const block = getBlocks(kernel)[0] as { width?: number; height?: number };
    expect(block.width).toBeUndefined();
    expect(block.height).toBeUndefined();
  });

  it('preserves multiple consecutive image blocks', () => {
    seed(
      kernel,
      paragraphRoot([
        blockImage({ altText: 'a', src: 'https://cdn/a.png' }),
        blockImage({ altText: 'b', src: 'https://cdn/b.png' }),
      ]),
    );
    const blocks = getBlocks(kernel);
    expect(blocks).toHaveLength(2);
    expect(blocks.map((b) => (b as { url: string }).url)).toEqual([
      'https://cdn/a.png',
      'https://cdn/b.png',
    ]);
  });
});
