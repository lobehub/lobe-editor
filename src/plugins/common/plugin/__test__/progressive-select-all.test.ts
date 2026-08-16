// @vitest-environment node
import {
  $computeTableMapSkipCellCheck,
  $createTableNodeWithDimensions,
  $isTableCellNode,
  $isTableSelection,
} from '@lexical/table';
import type { LexicalEditor, LexicalNode, PointType } from 'lexical';
import {
  $createParagraphNode,
  $createTextNode,
  $getRoot,
  $getSelection,
  $isElementNode,
  $isRangeSelection,
  $isRootNode,
  SELECT_ALL_COMMAND,
} from 'lexical';
import { beforeEach, describe, expect, it } from 'vitest';

import Editor, { resetRandomKey } from '@/editor-kernel';
import { $createCollapsibleNode, $isCollapsibleNode } from '@/plugins/collapsible';
import { CollapsiblePlugin } from '@/plugins/collapsible/plugin';
import { CommonPlugin } from '@/plugins/common';
import { TablePlugin } from '@/plugins/table';

describe('progressive select all', () => {
  let lexicalEditor: LexicalEditor;

  beforeEach(() => {
    resetRandomKey();
    const editor = Editor.createEditor().registerPlugins([
      CommonPlugin,
      TablePlugin,
      CollapsiblePlugin,
    ]);
    editor.initNodeEditor();
    lexicalEditor = editor.getLexicalEditor() as LexicalEditor;
  });

  it('keeps the default document-wide behavior outside structured blocks', () => {
    lexicalEditor.update(
      () => {
        const first = $createParagraphNode().append($createTextNode('First'));
        const second = $createParagraphNode().append($createTextNode('Second'));
        $getRoot().clear().append(first, second);
        first.selectStart();
      },
      { discrete: true },
    );

    expect(dispatchSelectAll()).toBe(true);
    expectDocumentSelection(2);
  });

  it('expands from the current cell to the table and then the document', () => {
    let firstCellKey = '';
    let tableKey = '';
    let allCellKeys: string[] = [];

    lexicalEditor.update(
      () => {
        const table = $createTableNodeWithDimensions(2, 2, false);
        const [tableMap] = $computeTableMapSkipCellCheck(table, null, null);
        const firstCell = tableMap[0]?.[0]?.cell;
        if (!firstCell) throw new Error('Missing first table cell');

        firstCellKey = firstCell.getKey();
        tableKey = table.getKey();
        allCellKeys = Array.from(new Set(tableMap.flat().map(({ cell }) => cell.getKey())));

        const before = $createParagraphNode().append($createTextNode('Before'));
        const after = $createParagraphNode().append($createTextNode('After'));
        $getRoot().clear().append(before, table, after);
        firstCell.getFirstDescendant()?.selectStart();
      },
      { discrete: true },
    );

    expect(dispatchSelectAll()).toBe(true);
    lexicalEditor.getEditorState().read(() => {
      const selection = $getSelection();
      expect($isTableSelection(selection)).toBe(true);
      if (!$isTableSelection(selection)) return;
      expect(selection.tableKey).toBe(tableKey);
      expect(selection.anchor.key).toBe(firstCellKey);
      expect(selection.focus.key).toBe(firstCellKey);
    });

    expect(dispatchSelectAll()).toBe(true);
    lexicalEditor.getEditorState().read(() => {
      const selection = $getSelection();
      expect($isTableSelection(selection)).toBe(true);
      if (!$isTableSelection(selection)) return;

      const selectedCellKeys = selection
        .getNodes()
        .filter($isTableCellNode)
        .map((cell) => cell.getKey());
      expect(new Set(selectedCellKeys)).toEqual(new Set(allCellKeys));
    });

    expect(dispatchSelectAll()).toBe(true);
    expectDocumentSelection(3);
  });

  it.each([
    ['title', true],
    ['body', false],
  ] as const)(
    'expands from collapsible %s content to the block and then the document',
    (child, collapsed) => {
      let collapsibleKey = '';
      let collapsibleSize = 0;

      lexicalEditor.update(
        () => {
          const before = $createParagraphNode().append($createTextNode('Before'));
          const title = $createParagraphNode().append($createTextNode('Details'));
          const body = $createParagraphNode().append($createTextNode('Hidden details'));
          const collapsible = $createCollapsibleNode('Details', collapsed).append(title, body);
          const after = $createParagraphNode().append($createTextNode('After'));

          collapsibleKey = collapsible.getKey();
          collapsibleSize = collapsible.getChildrenSize();
          $getRoot().clear().append(before, collapsible, after);
          collapsible.getChildAtIndex(child === 'title' ? 0 : 1)?.selectStart();
        },
        { discrete: true },
      );

      expect(dispatchSelectAll()).toBe(true);
      lexicalEditor.getEditorState().read(() => {
        const selection = $getSelection();
        expect($isRangeSelection(selection)).toBe(true);
        if (!$isRangeSelection(selection)) return;
        expect(selection.anchor.key).toBe(collapsibleKey);
        expect(selection.anchor.offset).toBe(0);
        expect(selection.focus.key).toBe(collapsibleKey);
        expect(selection.focus.offset).toBe(collapsibleSize);
      });

      expect(dispatchSelectAll()).toBe(true);
      expectDocumentSelection(3);
    },
  );

  function dispatchSelectAll(): boolean {
    const handled = lexicalEditor.dispatchCommand(SELECT_ALL_COMMAND, {} as KeyboardEvent);
    lexicalEditor.update(() => {}, { discrete: true });
    return handled;
  }

  function expectDocumentSelection(rootSize: number): void {
    lexicalEditor.getEditorState().read(() => {
      const selection = $getSelection();
      expect($isRangeSelection(selection)).toBe(true);
      if (!$isRangeSelection(selection)) return;
      expect($getRoot().getChildrenSize()).toBe(rootSize);
      expect(isDocumentBoundary(selection.anchor, 'start')).toBe(true);
      expect(isDocumentBoundary(selection.focus, 'end')).toBe(true);

      const collapsible = $getRoot().getChildren().find($isCollapsibleNode);
      if (collapsible) expect(selection.getNodes()).toContain(collapsible);
    });
  }

  function isDocumentBoundary(point: PointType, edge: 'end' | 'start'): boolean {
    let node: LexicalNode = point.getNode();
    if ($isRootNode(node)) {
      return point.offset === (edge === 'start' ? 0 : node.getChildrenSize());
    }

    const boundaryOffset =
      edge === 'start'
        ? 0
        : $isElementNode(node)
          ? node.getChildrenSize()
          : node.getTextContentSize();
    if (point.offset !== boundaryOffset) return false;

    while (true) {
      if (edge === 'start' ? node.getPreviousSibling() : node.getNextSibling()) return false;
      const parent = node.getParent();
      if (!parent) return false;
      if ($isRootNode(parent)) return true;
      node = parent;
    }
  }
});
