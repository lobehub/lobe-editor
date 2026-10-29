import { createBinding, type Provider } from '@lexical/yjs';
import { Doc } from 'yjs';
import { describe, expect, it } from 'vitest';

import { moment } from '@/editor-kernel';
import { Kernel } from '@/editor-kernel/kernel';
import { CommonPlugin } from '@/plugins/common';
import { DiffAction, LITEXML_DIFFNODE_ALL_COMMAND, LitexmlPlugin } from '@/plugins/litexml';
import { MarkdownPlugin } from '@/plugins/markdown';
import { TablePlugin } from '@/plugins/table';

import { initializeEditor } from '../plugin/utils/editor-state';
import { YjsService } from '../service';

if (!globalThis.ResizeObserver) {
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as typeof ResizeObserver;
}

const source =
  '<?xml version="1.0" encoding="UTF-8"?><root><table id="table" colWidths="100,100,100">' +
  '<tr id="row"><td id="a"><p>A</p></td><td id="b"><p>B</p></td>' +
  '<td id="c"><p>C</p></td></tr></table></root>';

const createProvider = (): Provider => ({
  awareness: {
    getLocalState: () => null,
    getStates: () => new Map(),
    off: () => undefined,
    on: () => undefined,
    setLocalState: () => undefined,
    setLocalStateField: () => undefined,
  },
  connect: () => undefined,
  disconnect: () => undefined,
  off: () => undefined,
  on: () => undefined,
});

const createEditor = (): Kernel => {
  const editor = new Kernel();
  editor.registerPlugins([CommonPlugin, LitexmlPlugin, MarkdownPlugin, TablePlugin]);
  editor.setRootElement(document.createElement('div'));
  editor.setDocument('litexml', source);
  return editor;
};

const createLegacySnapshot = (editor: Kernel, diffType: 'add' | 'remove') => {
  const snapshot = structuredClone(editor.getDocument('json')) as any;
  const row = snapshot.root.children[0].children[0];
  const templateCell = row.children[0];
  const makeCell = (id: string, text: string) => ({
    ...structuredClone(templateCell),
    $: { ...templateCell.$, properties: { ...templateCell.$?.properties, nodeId: id } },
    children: [
      {
        ...structuredClone(templateCell.children[0]),
        children: [{ ...templateCell.children[0].children[0], text }],
      },
    ],
    id,
  });

  row.children.push({
    children: [makeCell('review-cell-one', 'D'), makeCell('review-cell-two', 'E')],
    diffType,
    direction: null,
    format: '',
    id: 'legacy-wrapper',
    indent: 0,
    type: 'diff',
    version: 1,
  });

  return snapshot;
};

const getRow = (editor: Kernel) => (editor.getDocument('json') as any).root.children[0].children[0];

describe('Yjs legacy table cell snapshot migration', () => {
  it.each([
    { action: DiffAction.Accept, diffType: 'add' as const, expectedCellCount: 5, path: 'initial' },
    { action: DiffAction.Reject, diffType: 'add' as const, expectedCellCount: 3, path: 'initial' },
    {
      action: DiffAction.Accept,
      diffType: 'remove' as const,
      expectedCellCount: 3,
      path: 'external',
    },
    {
      action: DiffAction.Reject,
      diffType: 'remove' as const,
      expectedCellCount: 5,
      path: 'external',
    },
  ])(
    'preserves cell identity and resolves a legacy $diffType cell via the Yjs $path path',
    async ({ action, diffType, expectedCellCount, path }) => {
      const editor = createEditor();
      const snapshot = createLegacySnapshot(editor, diffType);
      const originalSnapshot = structuredClone(snapshot);

      if (path === 'initial') {
        initializeEditor(editor.getLexicalEditor()!, JSON.stringify(snapshot), {
          discrete: true,
          skipIfNotEmpty: false,
        });
      } else {
        const doc = new Doc();
        const provider = createProvider();
        const binding = createBinding(
          editor.getLexicalEditor()!,
          provider,
          'legacy-table-page',
          doc,
          new Map(),
        );
        const service = new YjsService();
        service.setState({ binding, doc, docMap: new Map(), id: 'legacy-table-page', provider });
        expect(service.applyExternalEditorData(snapshot)).toBe(true);
      }

      const stagedCells = getRow(editor).children.slice(3);
      expect(stagedCells.map((cell: any) => cell.type)).toEqual([
        'table-cell-diff',
        'table-cell-diff',
      ]);
      expect(stagedCells.map((cell: any) => cell.$.properties.nodeId)).toEqual([
        'review-cell-one',
        'review-cell-two',
      ]);
      expect(stagedCells.map((cell: any) => cell.changeId)).toEqual([
        stagedCells[0].changeId,
        stagedCells[0].changeId,
      ]);
      expect(stagedCells[0].changeId).toEqual(expect.any(String));
      expect(stagedCells.map((cell: any) => cell.diffType)).toEqual([diffType, diffType]);
      expect(snapshot).toEqual(originalSnapshot);

      editor.dispatchCommand(LITEXML_DIFFNODE_ALL_COMMAND, { action });
      await moment();

      const resolvedCells = getRow(editor).children;
      expect(resolvedCells).toHaveLength(expectedCellCount);
      expect(resolvedCells.every((cell: any) => cell.type === 'tablecell')).toBe(true);
      if (expectedCellCount === 5) {
        expect(resolvedCells.slice(3).map((cell: any) => cell.$.properties.nodeId)).toEqual([
          'review-cell-one',
          'review-cell-two',
        ]);
        expect(
          resolvedCells.slice(3).map((cell: any) => cell.children[0].children[0].text),
        ).toEqual(['D', 'E']);
      }

      editor.destroy();
    },
  );
});
