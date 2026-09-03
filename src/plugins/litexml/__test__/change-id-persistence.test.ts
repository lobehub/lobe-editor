// @vitest-environment node

import { createBinding, type Provider, type ProviderAwareness, type UserState } from '@lexical/yjs';
import { TableCellNode, TableRowNode } from '@lexical/table';
import { $nodesOfType } from 'lexical';
import { afterEach, describe, expect, it } from 'vitest';
import { Doc, encodeStateAsUpdate } from 'yjs';

import { moment } from '@/editor-kernel';
import { exportYjsSnapshotProjection, HeadlessEditor } from '@/headless';
import { DiffAction, LITEXML_DIFFNODE_ALL_COMMAND } from '@/plugins/litexml';
import {
  createCollaborativeAgentCommandGateway,
  IRewriteCommandResultService,
  LITEXML_MODIFY_COMMAND,
} from '@/plugins/litexml/command';
import { TableCellDiffNode } from '@/plugins/litexml/node/TableCellDiffNode';
import { TableRowDiffNode } from '@/plugins/litexml/node/TableRowDiffNode';
import { $getNodeProperties } from '@/plugins/properties/state';
import { $getNodeId } from '@/plugins/properties/utils';
import { syncCurrentEditorStateToYjs } from '@/plugins/yjs/plugin/utils/sync';

const TABLE_XML =
  '<root><table id="table-id"><tr id="row-id"><td id="cell-id"><p>Before</p></td><td id="cell-two"><p>Keep</p></td></tr><tr id="row-two"><td id="cell-three"><p>Other</p></td><td id="cell-four"><p>Keep</p></td></tr></table></root>';

class ReadOnlyAwareness implements ProviderAwareness {
  getLocalState(): UserState | null {
    return null;
  }

  getStates(): Map<number, UserState> {
    return new Map();
  }

  off(): void {}

  on(): void {}

  setLocalState(): void {}

  setLocalStateField(): void {}
}

const createReadOnlyProvider = (): Provider =>
  ({
    awareness: new ReadOnlyAwareness(),
    connect: () => undefined,
    disconnect: () => undefined,
    off: () => undefined,
    on: () => undefined,
  }) as Provider;

const collectChangeIds = (node: unknown, type: string, result: string[] = []): string[] => {
  if (!node || typeof node !== 'object') return result;
  const value = node as { changeId?: unknown; children?: unknown[]; type?: unknown };
  if (value.type === type && typeof value.changeId === 'string') result.push(value.changeId);
  value.children?.forEach((child) => collectChangeIds(child, type, result));
  return result;
};

const replaceChangeIds = (node: unknown, type: string, changeId: string): void => {
  if (!node || typeof node !== 'object') return;
  const value = node as { changeId?: unknown; children?: unknown[]; type?: unknown };
  if (value.type === type) value.changeId = changeId;
  value.children?.forEach((child) => replaceChangeIds(child, type, changeId));
};

const collectDurableNodeIds = (node: unknown, result: string[] = []): string[] => {
  if (!node || typeof node !== 'object') return result;
  const value = node as { $?: { properties?: { nodeId?: unknown } }; children?: unknown[] };
  const nodeId = value.$?.properties?.nodeId;
  if (typeof nodeId === 'string') result.push(nodeId);
  value.children?.forEach((child) => collectDurableNodeIds(child, result));
  return result;
};

interface TableDiffIdentitySnapshot {
  addCellIds: Array<string | undefined>;
  addLogicalRowId: unknown;
  addRowNodeId: string | undefined;
  removeCellIds: Array<string | undefined>;
  removeLogicalRowId: unknown;
  removeRowNodeId: string | undefined;
}

const readTableDiffIdentity = (editor: HeadlessEditor): TableDiffIdentitySnapshot => {
  const lexical = editor.kernel.getLexicalEditor();
  if (!lexical) throw new Error('Missing headless lexical editor.');
  return lexical.getEditorState().read(() => {
    const rows = $nodesOfType(TableRowDiffNode);
    const add = rows.find((row) => row.getDiffType() === 'add');
    const remove = rows.find((row) => row.getDiffType() === 'remove');
    if (!add || !remove) throw new Error('Expected a paired table row diff.');
    return {
      addCellIds: add.getChildren().map((cell) => $getNodeId(cell)),
      addLogicalRowId: $getNodeProperties(add).logicalNodeId,
      addRowNodeId: $getNodeId(add),
      removeCellIds: remove.getChildren().map((cell) => $getNodeId(cell)),
      removeLogicalRowId: $getNodeProperties(remove).logicalNodeId,
      removeRowNodeId: $getNodeId(remove),
    };
  });
};

const getTableRowIds = (
  editor: HeadlessEditor,
  expectedRowId?: string,
): { cellIds: string[]; rowId?: string } => {
  const lexical = editor.kernel.getLexicalEditor();
  if (!lexical) throw new Error('Missing headless lexical editor.');
  return lexical.getEditorState().read(() => {
    const row = $nodesOfType(TableRowNode).find(
      (candidate) =>
        candidate.getType() === 'tablerow' &&
        candidate.getChildren().length > 0 &&
        (expectedRowId === undefined || $getNodeId(candidate) === expectedRowId),
    );
    if (!row) throw new Error('Missing table row.');
    return {
      cellIds: row
        .getChildren()
        .map((cell) => $getNodeId(cell))
        .filter(Boolean) as string[],
      rowId: $getNodeId(row),
    };
  });
};

const projectThroughYjs = async (editor: HeadlessEditor, roomId: string): Promise<unknown> => {
  const lexical = editor.kernel.getLexicalEditor();
  if (!lexical) throw new Error('Missing headless lexical editor.');
  const doc = new Doc();
  const provider = createReadOnlyProvider();
  const binding = createBinding(lexical, provider, roomId, doc, new Map([[roomId, doc]]));
  syncCurrentEditorStateToYjs(binding, provider);
  const update = encodeStateAsUpdate(doc);
  binding.root.destroy(binding);
  doc.destroy();
  return exportYjsSnapshotProjection({ roomId, update });
};

describe('LiteXML changeId persistence', () => {
  const editors: HeadlessEditor[] = [];

  afterEach(() => {
    while (editors.length > 0) editors.pop()?.destroy();
  });

  it('keeps row pairing tokens opaque across JSON and Yjs reloads', async () => {
    const editor = new HeadlessEditor();
    editors.push(editor);
    editor.hydrateLiteXML(TABLE_XML);
    await moment();

    const lexical = editor.kernel.getLexicalEditor()!;
    const rowKey = lexical.getEditorState().read(() => $nodesOfType(TableRowNode)[0]?.getKey());
    const operations = [
      {
        action: 'modify' as const,
        litexml: '<tr id="row-id"><td>After</td><td>Keep</td></tr>',
      },
    ];
    Object.defineProperties(operations, {
      attempt: { value: 2 },
      commandId: { value: 'command-row-persistence' },
      generationId: { value: 'generation-row-persistence' },
      model: { value: 'test-model' },
      provider: { value: 'test-provider' },
      requestId: { value: 'request-row-persistence' },
    });
    const gateway = createCollaborativeAgentCommandGateway(
      lexical,
      editor.kernel.requireService(IRewriteCommandResultService)!,
    );
    const rowResult = await gateway.dispatch(LITEXML_MODIFY_COMMAND, operations);
    expect(rowResult).toMatchObject({
      commandId: 'command-row-persistence',
      status: 'diff-created',
    });
    await moment();

    const staged = editor.export().editorData;
    const stagedIds = collectChangeIds(staged.root, 'table-row-diff');
    expect(stagedIds).toHaveLength(2);
    expect(stagedIds[0]).toBe(stagedIds[1]);
    expect(stagedIds[0]).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu,
    );
    expect(rowKey).toBeDefined();
    expect(stagedIds).not.toContain(rowKey);
    expect(JSON.stringify(staged)).toContain('request-row-persistence');
    expect(JSON.stringify(staged)).toContain('generation-row-persistence');

    const jsonReload = new HeadlessEditor();
    editors.push(jsonReload);
    jsonReload.hydrateEditorData(staged);
    await moment();
    expect(collectChangeIds(jsonReload.export().editorData.root, 'table-row-diff')).toEqual(
      stagedIds,
    );

    const legacyJson = structuredClone(staged);
    replaceChangeIds(legacyJson.root, 'table-row-diff', '3:4');
    const legacyReload = new HeadlessEditor();
    editors.push(legacyReload);
    legacyReload.hydrateEditorData(legacyJson);
    await moment();
    const normalizedLegacyIds = collectChangeIds(
      legacyReload.export().editorData.root,
      'table-row-diff',
    );
    expect(normalizedLegacyIds).toHaveLength(2);
    expect(normalizedLegacyIds[0]).toBe(normalizedLegacyIds[1]);
    expect(normalizedLegacyIds[0]).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu,
    );

    const yjsProjection = (await projectThroughYjs(jsonReload, 'change-id-row-room')) as {
      editorData: unknown;
    };
    expect(
      collectChangeIds((yjsProjection.editorData as { root: unknown }).root, 'table-row-diff'),
    ).toEqual(stagedIds);
    expect(JSON.stringify(yjsProjection.editorData)).toContain('command-row-persistence');
  });

  it('keeps table diff wrappers private while preserving unique row/cell identity', async () => {
    const editor = new HeadlessEditor();
    editors.push(editor);
    editor.hydrateLiteXML(TABLE_XML);
    await moment();

    const original = getTableRowIds(editor);
    expect(original.rowId).toBeTruthy();
    expect(original.cellIds).toEqual(['cell-id', 'cell-two']);

    const lexical = editor.kernel.getLexicalEditor()!;
    const gateway = createCollaborativeAgentCommandGateway(
      lexical,
      editor.kernel.requireService(IRewriteCommandResultService)!,
    );
    const operations = [
      {
        action: 'modify' as const,
        litexml: '<tr id="row-id"><td>After</td><td>Keep</td></tr>',
      },
    ];
    Object.defineProperty(operations, 'requestId', { value: 'request-table-identity' });
    const result = await gateway.dispatch(LITEXML_MODIFY_COMMAND, operations);
    expect(result.status).toBe('diff-created');
    await moment();

    const pending = readTableDiffIdentity(editor);
    expect(pending.removeRowNodeId).toBeUndefined();
    expect(pending.addRowNodeId).toBeUndefined();
    expect(pending.removeLogicalRowId).toBe(original.rowId);
    expect(pending.addLogicalRowId).toBe(original.rowId);
    expect(pending.removeCellIds).toEqual(original.cellIds);
    expect(pending.addCellIds.every((id): id is string => typeof id === 'string')).toBe(true);
    expect(pending.addCellIds).not.toEqual(pending.removeCellIds);
    expect(new Set([...pending.removeCellIds, ...pending.addCellIds]).size).toBe(
      pending.removeCellIds.length + pending.addCellIds.length,
    );

    const staged = editor.export().editorData;
    const stagedRowDiffs = [
      ...(staged.root as any).children[0].children.filter(
        (row: any) => row.type === 'table-row-diff',
      ),
    ];
    expect(stagedRowDiffs).toHaveLength(2);
    stagedRowDiffs.forEach((row: any) => {
      expect(row.$?.properties?.nodeId).toBeUndefined();
      expect(row.$?.properties?.logicalNodeId).toBe(original.rowId);
    });
    const stagedIds = collectDurableNodeIds(staged.root);
    expect(new Set(stagedIds).size).toBe(stagedIds.length);

    const legacyWrapperJson = structuredClone(staged);
    (legacyWrapperJson.root as any).children[0].children
      .filter((row: any) => row.type === 'table-row-diff')
      .forEach((row: any, index: number) => {
        row.$ = {
          properties: {
            ...row.$?.properties,
            nodeId: `legacy-row-wrapper-${index}`,
          },
        };
      });
    const legacyWrapperReload = new HeadlessEditor();
    editors.push(legacyWrapperReload);
    legacyWrapperReload.hydrateEditorData(legacyWrapperJson);
    await moment();
    const normalizedWrapper = readTableDiffIdentity(legacyWrapperReload);
    expect(normalizedWrapper.removeRowNodeId).toBeUndefined();
    expect(normalizedWrapper.addRowNodeId).toBeUndefined();
    expect(normalizedWrapper.removeLogicalRowId).toBe(original.rowId);
    expect(normalizedWrapper.addLogicalRowId).toBe(original.rowId);

    const jsonReload = new HeadlessEditor();
    editors.push(jsonReload);
    jsonReload.hydrateEditorData(staged);
    await moment();
    const reloadedPending = readTableDiffIdentity(jsonReload);
    expect(reloadedPending.removeRowNodeId).toBeUndefined();
    expect(reloadedPending.addRowNodeId).toBeUndefined();
    expect(reloadedPending.removeLogicalRowId).toBe(original.rowId);
    expect(reloadedPending.addLogicalRowId).toBe(original.rowId);
    expect(new Set(collectDurableNodeIds(jsonReload.export().editorData.root)).size).toBe(
      collectDurableNodeIds(jsonReload.export().editorData.root).length,
    );

    jsonReload.kernel.dispatchCommand(LITEXML_DIFFNODE_ALL_COMMAND, {
      action: DiffAction.Accept,
    });
    await moment();
    expect(getTableRowIds(jsonReload, original.rowId)).toEqual(original);
    jsonReload.kernel
      .getLexicalEditor()!
      .getEditorState()
      .read(() => {
        const acceptedRow = $nodesOfType(TableRowNode).find(
          (candidate) => $getNodeId(candidate) === original.rowId,
        );
        expect(acceptedRow).toBeDefined();
        expect($getNodeProperties(acceptedRow!).provenance).toMatchObject({
          generationId: 'request-table-identity',
          source: 'ai',
        });
      });

    const yjsProjection = (await projectThroughYjs(editor, 'table-wrapper-identity-room')) as {
      editorData: any;
    };
    const projectedRows = yjsProjection.editorData.root.children[0].children.filter(
      (row: any) => row.type === 'table-row-diff',
    );
    expect(projectedRows).toHaveLength(2);
    projectedRows.forEach((row: any) => {
      expect(row.$?.properties?.nodeId).toBeUndefined();
      expect(row.$?.properties?.logicalNodeId).toBe(original.rowId);
    });
    const projectedIds = collectDurableNodeIds(yjsProjection.editorData.root);
    expect(new Set(projectedIds).size).toBe(projectedIds.length);

    const yjsReload = new HeadlessEditor();
    editors.push(yjsReload);
    yjsReload.hydrateEditorData(yjsProjection.editorData);
    await moment();
    yjsReload.kernel.dispatchCommand(LITEXML_DIFFNODE_ALL_COMMAND, {
      action: DiffAction.Accept,
    });
    await moment();
    expect(getTableRowIds(yjsReload, original.rowId)).toEqual(original);

    editor.kernel.dispatchCommand(LITEXML_DIFFNODE_ALL_COMMAND, { action: DiffAction.Reject });
    await moment();
    expect(getTableRowIds(editor, original.rowId)).toEqual(original);
    editor.kernel
      .getLexicalEditor()!
      .getEditorState()
      .read(() => {
        const restoredRow = $nodesOfType(TableRowNode).find(
          (candidate) => $getNodeId(candidate) === original.rowId,
        );
        expect(restoredRow).toBeDefined();
        expect($getNodeProperties(restoredRow!).provenance).toBeUndefined();
      });
  });

  it('uses a durable table identity for cell grouping across JSON and Yjs reloads', async () => {
    const editor = new HeadlessEditor();
    editors.push(editor);
    editor.hydrateLiteXML(TABLE_XML);
    await moment();

    const lexical = editor.kernel.getLexicalEditor()!;
    const cellKey = lexical.getEditorState().read(() =>
      $nodesOfType(TableCellNode)
        .find((cell) => cell.getKey() !== 'root')
        ?.getKey(),
    );
    const cellNodeId = lexical.getEditorState().read(() => {
      const cell = $nodesOfType(TableCellNode).find((candidate) => candidate.getKey() !== 'root');
      return cell ? $getNodeId(cell) : undefined;
    });
    const gateway = createCollaborativeAgentCommandGateway(
      lexical,
      editor.kernel.requireService(IRewriteCommandResultService)!,
    );
    const operations = [
      {
        action: 'remove' as const,
        id: 'cell-id',
      },
    ];
    Object.defineProperties(operations, {
      attempt: { value: 3 },
      commandId: { value: 'command-cell-persistence' },
      generationId: { value: 'generation-cell-persistence' },
      model: { value: 'test-model' },
      provider: { value: 'test-provider' },
      requestId: { value: 'request-cell-persistence' },
    });
    const cellResult = await gateway.dispatch(LITEXML_MODIFY_COMMAND, operations);
    expect(cellResult).toMatchObject({
      commandId: 'command-cell-persistence',
      status: 'diff-created',
    });
    await moment();

    lexical.getEditorState().read(() => {
      const diffCell = $nodesOfType(TableCellDiffNode)[0];
      expect(diffCell).toBeDefined();
      expect($getNodeId(diffCell!)).toBeUndefined();
      expect($getNodeProperties(diffCell!).logicalNodeId).toBe(cellNodeId);
      expect($getNodeId(diffCell!.getFirstChild()!)).toBeUndefined();
    });

    const staged = editor.export().editorData;
    const stagedIds = collectChangeIds(staged.root, 'table-cell-diff');
    expect(stagedIds).toEqual(['table:table-id:column:0']);
    expect(cellKey).toBeDefined();
    expect(stagedIds).not.toContain(cellKey);
    expect(JSON.stringify(staged)).toContain('source":"ai"');

    const legacyWrapperJson = structuredClone(staged);
    const markLegacyCellWrapper = (node: any): void => {
      if (!node || typeof node !== 'object') return;
      if (node.type === 'table-cell-diff') {
        node.$ = {
          properties: {
            ...node.$?.properties,
            nodeId: 'legacy-cell-wrapper',
          },
        };
      }
      node.children?.forEach(markLegacyCellWrapper);
    };
    markLegacyCellWrapper(legacyWrapperJson.root);
    const legacyWrapperReload = new HeadlessEditor();
    editors.push(legacyWrapperReload);
    legacyWrapperReload.hydrateEditorData(legacyWrapperJson);
    await moment();
    legacyWrapperReload.kernel
      .getLexicalEditor()!
      .getEditorState()
      .read(() => {
        const diffCell = $nodesOfType(TableCellDiffNode)[0];
        expect(diffCell).toBeDefined();
        expect($getNodeId(diffCell!)).toBeUndefined();
        expect($getNodeProperties(diffCell!).logicalNodeId).toBe(cellNodeId);
      });

    const jsonReload = new HeadlessEditor();
    editors.push(jsonReload);
    jsonReload.hydrateEditorData(staged);
    await moment();
    expect(collectChangeIds(jsonReload.export().editorData.root, 'table-cell-diff')).toEqual(
      stagedIds,
    );
    jsonReload.kernel
      .getLexicalEditor()!
      .getEditorState()
      .read(() => {
        const diffCell = $nodesOfType(TableCellDiffNode)[0];
        expect(diffCell).toBeDefined();
        expect($getNodeId(diffCell!)).toBeUndefined();
        expect($getNodeProperties(diffCell!).logicalNodeId).toBe(cellNodeId);
      });

    const legacyJson = structuredClone(staged);
    replaceChangeIds(legacyJson.root, 'table-cell-diff', '1:column:0');
    const legacyReload = new HeadlessEditor();
    editors.push(legacyReload);
    legacyReload.hydrateEditorData(legacyJson);
    await moment();
    const normalizedLegacyIds = collectChangeIds(
      legacyReload.export().editorData.root,
      'table-cell-diff',
    );
    expect(normalizedLegacyIds).toEqual([
      expect.stringMatching(
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu,
      ),
    ]);

    const yjsProjection = (await projectThroughYjs(jsonReload, 'change-id-cell-room')) as {
      editorData: unknown;
    };
    expect(
      collectChangeIds((yjsProjection.editorData as { root: unknown }).root, 'table-cell-diff'),
    ).toEqual(stagedIds);
    expect(JSON.stringify(yjsProjection.editorData)).toContain('request-cell-persistence');

    editor.kernel.dispatchCommand(LITEXML_DIFFNODE_ALL_COMMAND, { action: DiffAction.Reject });
    await moment();
    const restoredCell = getTableRowIds(editor).cellIds[0];
    expect(restoredCell).toBe(cellNodeId);

    const addedCellOperations = [
      {
        action: 'insert' as const,
        afterId: 'cell-two',
        litexml: '<td><p>Added cell</p></td>',
      },
    ];
    Object.defineProperty(addedCellOperations, 'requestId', { value: 'request-cell-add' });
    const addedCellResult = await gateway.dispatch(LITEXML_MODIFY_COMMAND, addedCellOperations);
    expect(addedCellResult.status).toBe('diff-created');
    await moment();

    const addedCellId = lexical.getEditorState().read(() => {
      const diffCell = $nodesOfType(TableCellDiffNode).find(
        (candidate) => candidate.getDiffType() === 'add',
      );
      expect(diffCell).toBeDefined();
      expect($getNodeId(diffCell!)).toBeUndefined();
      const logicalNodeId = $getNodeProperties(diffCell!).logicalNodeId;
      expect(typeof logicalNodeId).toBe('string');
      return logicalNodeId as string;
    });
    editor.kernel.dispatchCommand(LITEXML_DIFFNODE_ALL_COMMAND, { action: DiffAction.Accept });
    await moment();
    lexical.getEditorState().read(() => {
      const acceptedCell = $nodesOfType(TableCellNode).find(
        (candidate) => $getNodeId(candidate) === addedCellId,
      );
      expect(acceptedCell).toBeDefined();
      expect($getNodeProperties(acceptedCell!).provenance).toMatchObject({
        generationId: 'request-cell-add',
        source: 'ai',
      });
    });
  });
});
