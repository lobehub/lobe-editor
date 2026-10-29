import { describe, expect, it } from 'vitest';

import { migrateLegacyTableCellDiffs } from './migrate-legacy-table-cell-diffs';

describe('migrateLegacyTableCellDiffs', () => {
  it('migrates legacy row cell diffs idempotently without changing input or cell identity', () => {
    const input = {
      root: {
        children: [
          {
            children: [
              {
                children: [
                  {
                    $: { properties: { nodeId: 'legacy-cell-id' } },
                    children: [{ type: 'paragraph', version: 1 }],
                    id: 'legacy-cell-id',
                    type: 'tablecell',
                    version: 1,
                  },
                ],
                diffType: 'add',
                type: 'diff',
                version: 1,
              },
            ],
            type: 'tablerow',
            version: 1,
          },
        ],
        type: 'root',
        version: 1,
      },
    };
    const original = structuredClone(input);

    const migratedRoot = migrateLegacyTableCellDiffs(input.root) as typeof input.root;
    const cell = migratedRoot.children[0].children[0];

    expect(input).toEqual(original);
    expect(cell).toMatchObject({
      $: { properties: { nodeId: 'legacy-cell-id' } },
      diffType: 'add',
      id: 'legacy-cell-id',
      type: 'table-cell-diff',
      children: [{ diffType: 'add', type: 'diff' }],
    });
    expect(migrateLegacyTableCellDiffs(migratedRoot)).toEqual(migratedRoot);
  });

  it('leaves non-legacy diffs and cells outside table rows unchanged', () => {
    const input = {
      root: {
        children: [
          {
            children: [{ type: 'tablecell', version: 1 }],
            diffType: 'modify',
            type: 'diff',
            version: 1,
          },
          {
            children: [
              {
                children: [{ type: 'tablecell', version: 1 }],
                diffType: 'add',
                type: 'diff',
                version: 1,
              },
            ],
            type: 'paragraph',
            version: 1,
          },
        ],
        type: 'root',
        version: 1,
      },
    };

    const original = structuredClone(input);
    expect(migrateLegacyTableCellDiffs(input.root)).toEqual(input.root);
    expect(input).toEqual(original);
  });
});
