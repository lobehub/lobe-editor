import { describe, expect, it } from 'vitest';

import { buildTocTree, flattenTocTree } from '../utils';

describe('buildTocTree', () => {
  it('nests headings by depth while preserving document order', () => {
    const tree = buildTocTree([
      { depth: 1, key: 'a', tag: 'h1', title: 'Intro' },
      { depth: 2, key: 'b', tag: 'h2', title: 'Background' },
      { depth: 3, key: 'c', tag: 'h3', title: 'Details' },
      { depth: 2, key: 'd', tag: 'h2', title: 'Result' },
      { depth: 1, key: 'e', tag: 'h1', title: 'Summary' },
    ]);

    expect(tree).toEqual([
      {
        children: [
          {
            children: [
              {
                children: [],
                depth: 3,
                key: 'c',
                tag: 'h3',
                title: 'Details',
              },
            ],
            depth: 2,
            key: 'b',
            tag: 'h2',
            title: 'Background',
          },
          {
            children: [],
            depth: 2,
            key: 'd',
            tag: 'h2',
            title: 'Result',
          },
        ],
        depth: 1,
        key: 'a',
        tag: 'h1',
        title: 'Intro',
      },
      {
        children: [],
        depth: 1,
        key: 'e',
        tag: 'h1',
        title: 'Summary',
      },
    ]);
  });

  it('keeps skipped-depth headings under the nearest shallower heading', () => {
    const tree = buildTocTree([
      { depth: 2, key: 'a', tag: 'h2', title: 'Start' },
      { depth: 4, key: 'b', tag: 'h4', title: 'Deep' },
      { depth: 3, key: 'c', tag: 'h3', title: 'Middle' },
    ]);

    expect(tree).toEqual([
      {
        children: [
          {
            children: [],
            depth: 4,
            key: 'b',
            tag: 'h4',
            title: 'Deep',
          },
          {
            children: [],
            depth: 3,
            key: 'c',
            tag: 'h3',
            title: 'Middle',
          },
        ],
        depth: 2,
        key: 'a',
        tag: 'h2',
        title: 'Start',
      },
    ]);
  });

  it('flattens a toc tree in render order', () => {
    const tree = buildTocTree([
      { depth: 1, key: 'a', tag: 'h1', title: 'Intro' },
      { depth: 2, key: 'b', tag: 'h2', title: 'Background' },
      { depth: 1, key: 'c', tag: 'h1', title: 'Summary' },
    ]);

    expect(flattenTocTree(tree).map((item) => item.key)).toEqual(['a', 'b', 'c']);
  });
});
