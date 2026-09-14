import { $createParagraphNode, $createTextNode, $getRoot, $nodesOfType } from 'lexical';
import {
  $createTableNodeWithDimensions,
  type TableCellNode,
  type TableRowNode,
  TableNode,
} from '@lexical/table';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import Editor from '@/editor-kernel';
import { CommonPlugin } from '@/plugins/common';
import { BlockPlugin } from '@/plugins/block/plugin';
import { TablePlugin } from '@/plugins/table/plugin';
import { HoleNode } from '@/plugins/common/node/hole';

import { $createHoleNode } from '@/plugins/common/node/hole';

import { $areBlockKeysEquivalent, $isBlockKeyOwnedByTable } from './block-identity';

describe('$areBlockKeysEquivalent', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'ResizeObserver',
      class {
        observe(): void {}
        disconnect(): void {}
      },
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    document.body.replaceChildren();
  });

  it('matches a Hole structural key with its logical payload key', () => {
    const editor = Editor.createEditor().registerPlugins([CommonPlugin]);
    const lexical = editor.initNodeEditor();
    if (!lexical) throw new Error('Lexical editor missing');

    let holeKey = '';
    let payloadKey = '';
    lexical.update(() => {
      const payload = $createParagraphNode().append($createTextNode('table payload'));
      const hole = $createHoleNode(payload);
      holeKey = hole.getKey();
      payloadKey = payload.getKey();
      $getRoot().append(hole);
    });

    lexical.read(() => {
      expect($areBlockKeysEquivalent(holeKey, payloadKey)).toBe(true);
      expect($areBlockKeysEquivalent(holeKey, 'missing-key')).toBe(false);
    });
    editor.destroy();
  });

  it('keeps the table logical key and Hole structural key available to block UI', async () => {
    const editor = Editor.createEditor().registerPlugins([CommonPlugin, TablePlugin, BlockPlugin]);
    const lexical = editor.initNodeEditor();
    if (!lexical) throw new Error('Lexical editor missing');
    const root = document.createElement('div');
    root.contentEditable = 'true';
    document.body.append(root);
    editor.setRootElement(root);

    lexical.update(() => {
      const table = $createTableNodeWithDimensions(1, 1, false);
      const row = table.getFirstChild() as TableRowNode;
      const cell = row.getFirstChild() as TableCellNode;
      cell.append($createParagraphNode().append($createTextNode('cell')));
      $getRoot().append(table);
    });
    await new Promise<void>((resolve) => {
      queueMicrotask(() => resolve());
    });

    const table = lexical.read(() => $nodesOfType(TableNode)[0]);
    const hole = lexical.read(() => $nodesOfType(HoleNode)[0]);
    if (!table || !hole) throw new Error('Table Hole nodes missing');
    const cellParagraphKey = lexical.read(() => {
      const row = table.getFirstChild() as TableRowNode | null;
      const cell = row?.getFirstChild() as TableCellNode | null;
      const paragraph = cell?.getFirstChild();
      if (!row || !cell || !paragraph) throw new Error('Table cell paragraph missing');
      return paragraph.getKey();
    });
    const host = root.querySelector<HTMLElement>('[data-block-id]');
    if (!host) throw new Error('Table block host missing');
    expect(host.dataset.blockId).toBe(table.getKey());
    expect(host.dataset.blockStructuralId).toBe(hole.getKey());
    expect(lexical.read(() => $areBlockKeysEquivalent(table.getKey(), host.dataset.blockId!))).toBe(
      true,
    );
    expect(
      lexical.read(() => $areBlockKeysEquivalent(table.getKey(), host.dataset.blockStructuralId!)),
    ).toBe(true);
    expect(lexical.read(() => $isBlockKeyOwnedByTable(table.getKey(), cellParagraphKey))).toBe(
      true,
    );

    editor.destroy();
    root.remove();
  });
});
