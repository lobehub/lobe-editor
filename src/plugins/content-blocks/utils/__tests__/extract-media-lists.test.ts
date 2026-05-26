import { describe, expect, it } from 'vitest';

import { extractMediaLists } from '../extract-media-lists';

describe('extractMediaLists', () => {
  it('returns empty lists for empty input', () => {
    expect(extractMediaLists([])).toEqual({ fileList: [], imageList: [] });
  });

  it('ignores text blocks', () => {
    const lists = extractMediaLists([
      { text: 'hello', type: 'text' },
      { text: 'world', type: 'text' },
    ]);
    expect(lists.imageList).toEqual([]);
    expect(lists.fileList).toEqual([]);
  });

  it('collects images in order', () => {
    const lists = extractMediaLists([
      { alt: 'a', type: 'image', url: 'https://cdn/a.png' },
      { text: 'mid', type: 'text' },
      { alt: 'b', type: 'image', url: 'https://cdn/b.png' },
    ]);
    expect(lists.imageList).toHaveLength(2);
    expect(lists.imageList[0]).toMatchObject({ alt: 'a', url: 'https://cdn/a.png' });
    expect(lists.imageList[1]).toMatchObject({ alt: 'b', url: 'https://cdn/b.png' });
    expect(lists.imageList[0].id).toEqual(expect.any(String));
  });

  it('collects files with fileType inferred from extension', () => {
    const lists = extractMediaLists([
      { name: 'report.pdf', size: 1024, type: 'file', url: 'https://cdn/x.pdf' },
      { name: 'photo.PNG', type: 'file', url: 'https://cdn/y.png' },
      { name: 'noext', type: 'file', url: 'https://cdn/z' },
    ]);
    expect(lists.fileList[0].fileType).toBe('pdf');
    expect(lists.fileList[0].size).toBe(1024);
    expect(lists.fileList[1].fileType).toBe('png');
    expect(lists.fileList[2].fileType).toBe('unknown');
    expect(lists.fileList[2].size).toBe(0);
  });

  it('generates unique ids per entry', () => {
    const lists = extractMediaLists([
      { alt: '', type: 'image', url: 'a' },
      { alt: '', type: 'image', url: 'b' },
      { name: 'a.txt', type: 'file', url: 'fa' },
      { name: 'b.txt', type: 'file', url: 'fb' },
    ]);
    const ids = [
      lists.imageList[0].id,
      lists.imageList[1].id,
      lists.fileList[0].id,
      lists.fileList[1].id,
    ];
    expect(new Set(ids).size).toBe(4);
  });
});
