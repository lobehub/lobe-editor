import type { SerializedEditorState } from 'lexical';
import { describe, expect, it } from 'vitest';

import { extractMediaFromEditorState } from '../extract-media-from-editor-state';

const make = (children: unknown[]): SerializedEditorState =>
  ({
    root: {
      children,
      direction: null,
      format: '',
      indent: 0,
      type: 'root',
      version: 1,
    },
  }) as unknown as SerializedEditorState;

const text = (t: string) => ({
  detail: 0,
  format: 0,
  mode: 'normal',
  style: '',
  text: t,
  type: 'text',
  version: 1,
});

const image = (override: Record<string, unknown> = {}) => ({
  altText: 'alt',
  src: 'https://cdn/a.png',
  status: 'uploaded',
  type: 'image',
  version: 1,
  ...override,
});

const blockImage = (override: Record<string, unknown> = {}) => ({
  altText: 'block-alt',
  src: 'https://cdn/b.png',
  status: 'uploaded',
  type: 'block-image',
  version: 1,
  ...override,
});

const file = (override: Record<string, unknown> = {}) => ({
  fileUrl: 'https://cdn/x.pdf',
  name: 'x.pdf',
  size: 1024,
  status: 'uploaded',
  type: 'file',
  version: 1,
  ...override,
});

const paragraph = (children: unknown[]) => ({
  children,
  direction: null,
  format: '',
  indent: 0,
  textFormat: 0,
  textStyle: '',
  type: 'paragraph',
  version: 1,
});

const heading = (children: unknown[]) => ({
  children,
  direction: null,
  format: '',
  indent: 0,
  tag: 'h1',
  type: 'heading',
  version: 1,
});

const quote = (children: unknown[]) => ({
  children,
  direction: null,
  format: '',
  indent: 0,
  type: 'quote',
  version: 1,
});

describe('extractMediaFromEditorState', () => {
  it('returns empty lists for empty state', () => {
    expect(extractMediaFromEditorState(make([]))).toEqual({ fileList: [], imageList: [] });
  });

  it('returns empty lists for null/undefined input', () => {
    expect(extractMediaFromEditorState(null)).toEqual({ fileList: [], imageList: [] });
    expect(extractMediaFromEditorState(undefined)).toEqual({ fileList: [], imageList: [] });
  });

  it('extracts top-level image and block-image', () => {
    const lists = extractMediaFromEditorState(make([blockImage(), file()]));
    expect(lists.imageList).toHaveLength(1);
    expect(lists.imageList[0]).toMatchObject({ alt: 'block-alt', url: 'https://cdn/b.png' });
    expect(lists.fileList).toHaveLength(1);
    expect(lists.fileList[0]).toMatchObject({
      fileType: 'pdf',
      name: 'x.pdf',
      size: 1024,
      url: 'https://cdn/x.pdf',
    });
  });

  it('extracts images nested inside paragraph/heading/quote (DFS)', () => {
    const state = make([
      paragraph([text('before '), image({ src: 'https://cdn/p.png' }), text(' after')]),
      heading([image({ src: 'https://cdn/h.png' })]),
      quote([paragraph([image({ src: 'https://cdn/q.png' })])]),
    ]);
    const lists = extractMediaFromEditorState(state);
    const urls = lists.imageList.map((i) => i.url);
    expect(urls).toEqual(['https://cdn/p.png', 'https://cdn/h.png', 'https://cdn/q.png']);
  });

  it('skips non-uploaded images and files', () => {
    const lists = extractMediaFromEditorState(
      make([
        image({ status: 'loading' }),
        image({ status: 'error' }),
        blockImage({ status: undefined }),
        file({ status: 'pending' }),
        file({ status: 'error' }),
      ]),
    );
    expect(lists.imageList).toEqual([]);
    expect(lists.fileList).toEqual([]);
  });

  it('skips uploaded entries with empty url', () => {
    const lists = extractMediaFromEditorState(make([image({ src: '' }), file({ fileUrl: '' })]));
    expect(lists.imageList).toEqual([]);
    expect(lists.fileList).toEqual([]);
  });

  it('does not descend into image caption editor state', () => {
    const captionedImage = image({
      caption: {
        editorState: {
          root: {
            children: [paragraph([image({ src: 'https://cdn/inner.png' })])],
            type: 'root',
          },
        },
      },
      src: 'https://cdn/outer.png',
    });
    const lists = extractMediaFromEditorState(make([captionedImage]));
    expect(lists.imageList).toHaveLength(1);
    expect(lists.imageList[0].url).toBe('https://cdn/outer.png');
  });

  it('preserves DFS pre-order across nested containers', () => {
    const state = make([
      paragraph([image({ src: '1' }), image({ src: '2' })]),
      paragraph([image({ src: '3' })]),
      blockImage({ src: '4' }),
    ]);
    expect(extractMediaFromEditorState(state).imageList.map((i) => i.url)).toEqual([
      '1',
      '2',
      '3',
      '4',
    ]);
  });

  it('infers fileType from extension; falls back to unknown', () => {
    const lists = extractMediaFromEditorState(
      make([
        file({ fileUrl: 'a', name: 'report.PDF' }),
        file({ fileUrl: 'b', name: 'noext' }),
        file({ fileUrl: 'c', name: 'archive.tar.gz' }),
      ]),
    );
    expect(lists.fileList.map((f) => f.fileType)).toEqual(['pdf', 'unknown', 'gz']);
  });

  it('defaults missing size to 0 and missing name to "unknown"', () => {
    const lists = extractMediaFromEditorState(
      make([file({ fileUrl: 'u', name: undefined, size: undefined })]),
    );
    expect(lists.fileList[0]).toMatchObject({
      fileType: 'unknown',
      name: 'unknown',
      size: 0,
      url: 'u',
    });
  });

  it('generates a unique id per entry', () => {
    const lists = extractMediaFromEditorState(
      make([
        image({ src: 'a' }),
        image({ src: 'b' }),
        file({ fileUrl: 'fa', name: 'a.txt' }),
        file({ fileUrl: 'fb', name: 'b.txt' }),
      ]),
    );
    const ids = [
      lists.imageList[0].id,
      lists.imageList[1].id,
      lists.fileList[0].id,
      lists.fileList[1].id,
    ];
    expect(new Set(ids).size).toBe(4);
  });
});
