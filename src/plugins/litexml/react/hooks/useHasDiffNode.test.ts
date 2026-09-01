import { describe, expect, it } from 'vitest';

import type { IEditor } from '@/types';

import { hasDiffNode } from './useHasDiffNode';

function createEditorWithNodeTypes(...types: string[]): IEditor {
  const nodes = types.map((type) => ({ getType: () => type }));

  return {
    getLexicalEditor: () => ({
      getEditorState: () => ({
        _nodeMap: new Map(nodes.map((node, index) => [String(index), node])),
      }),
    }),
  } as unknown as IEditor;
}

describe('hasDiffNode', () => {
  it('detects regular diff nodes', () => {
    expect(hasDiffNode(createEditorWithNodeTypes('root', 'diff'))).toBe(true);
  });

  it('detects table row diff nodes', () => {
    expect(hasDiffNode(createEditorWithNodeTypes('root', 'table-row-diff'))).toBe(true);
  });

  it('ignores documents without pending diffs', () => {
    expect(hasDiffNode(createEditorWithNodeTypes('root', 'paragraph', 'table'))).toBe(false);
  });
});
