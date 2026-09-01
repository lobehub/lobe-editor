import {
  $createRangeSelection,
  $getRoot,
  $getSelection,
  $isElementNode,
  $isRangeSelection,
  $isTextNode,
  $setSelection,
  UNDO_COMMAND,
  createCommand,
  type RangeSelection,
} from 'lexical';
import { beforeEach, describe, expect, it } from 'vitest';

import Editor, { moment } from '@/editor-kernel';
import { CommonPlugin } from '@/plugins/common';
import {
  DiffAction,
  IRewriteCommandResultService,
  LITEXML_INSERT_COMMAND,
  LITEXML_MODIFY_COMMAND,
  LITEXML_DIFFNODE_ALL_COMMAND,
  LITEXML_REMOVE_COMMAND,
  LITEXML_REWRITE_RANGE_COMMAND,
  LitexmlPlugin,
} from '@/plugins/litexml';
import { hashRewriteText, validateLiteXMLInput } from '@/plugins/litexml/command';
import { createCollaborativeAgentCommandGateway } from '@/plugins/litexml/command/gateway';
import {
  collectIllegalNestedDiffPaths,
  findNewIllegalDiffPaths,
} from '@/plugins/litexml/diff-validation';
import { MarkdownPlugin } from '@/plugins/markdown';
import { ListPlugin } from '@/plugins/list';
import { PropertiesPlugin } from '@/plugins/properties';
import { TablePlugin } from '@/plugins/table';
import { $getNodeId } from '@/plugins/properties/utils';
import type { IEditor } from '@/types';

const textLeaves = (node: any): any[] => {
  if ($isTextNode(node)) return [node];
  if (!$isElementNode(node)) return [];
  return node.getChildren().flatMap(textLeaves);
};

const findProvenance = (node: any, generationId: string): any => {
  const provenance = node?.$?.properties?.provenance;
  if (provenance?.generationId === generationId) return provenance;
  return node?.children?.map((child: any) => findProvenance(child, generationId)).find(Boolean);
};

async function selectRange(
  editor: IEditor,
  startBlockIndex: number,
  startOffset: number,
  endBlockIndex: number,
  endOffset: number,
  reverse = false,
): Promise<RangeSelection> {
  const lexical = editor.getLexicalEditor()!;
  let selection: RangeSelection | undefined;
  lexical.update(() => {
    const root = $getRoot();
    const startBlock = root.getChildAtIndex(startBlockIndex);
    const endBlock = root.getChildAtIndex(endBlockIndex);
    if (!startBlock || !endBlock) throw new Error('selection block missing');
    const start = textLeaves(startBlock)[0];
    const endLeaves = textLeaves(endBlock);
    const end = endLeaves.at(-1);
    if (!$isTextNode(start) || !$isTextNode(end)) throw new Error('selection text missing');
    selection = $createRangeSelection();
    const anchor = reverse ? end : start;
    const focus = reverse ? start : end;
    const anchorOffset = reverse ? endOffset : startOffset;
    const focusOffset = reverse ? startOffset : endOffset;
    selection.anchor.set(anchor.getKey(), anchorOffset, 'text');
    selection.focus.set(focus.getKey(), focusOffset, 'text');
    $setSelection(selection);
  });
  await moment();
  if (!selection) throw new Error('selection not created');
  return selection;
}

describe('LITEXML_REWRITE_RANGE_COMMAND', () => {
  let editor: IEditor;

  beforeEach(() => {
    editor = Editor.createEditor();
    editor.registerPlugins([
      CommonPlugin,
      MarkdownPlugin,
      ListPlugin,
      LitexmlPlugin,
      PropertiesPlugin,
      TablePlugin,
    ]);
    editor.initNodeEditor();
  });

  it('creates a delayed diff for a partial paragraph and transfers identity on accept', async () => {
    editor.setDocument('markdown', 'Hello world');
    const lexical = editor.getLexicalEditor()!;
    let selection: ReturnType<typeof $createRangeSelection> | undefined;
    let originalNodeId = '';
    lexical.update(() => {
      const paragraph = $getRoot().getFirstChildOrThrow();
      if (!$isElementNode(paragraph)) throw new Error('paragraph missing');
      const text = paragraph.getFirstChild();
      if (!$isTextNode(text)) throw new Error('text missing');
      originalNodeId = $getNodeId(paragraph) || '';
      selection = $createRangeSelection();
      selection.anchor.set(text.getKey(), 0, 'text');
      selection.focus.set(text.getKey(), 5, 'text');
      $setSelection(selection);
    });
    await moment();

    const channel = editor.requireService(IRewriteCommandResultService);
    expect(channel?.subscribeReview).toEqual(expect.any(Function));
    const reviewEvents: unknown[] = [];
    const unsubscribeReview = channel?.subscribeReview?.((event) => reviewEvents.push(event));
    const payload = {
      attempt: 1,
      delay: true,
      expectedTextHash: hashRewriteText('Hello'),
      generationId: 'generation-1',
      model: 'test-model',
      provider: 'test-provider',
      replacementText: 'Hi',
      requestId: 'request-1',
      selection: selection!,
    } as const;
    editor.dispatchCommand(LITEXML_REWRITE_RANGE_COMMAND, payload);
    await moment();

    const result = channel?.get('request-1');
    expect(result?.status).toBe('diff-created');
    const pending = editor.getDocument('json') as any;
    const ids: string[] = [];
    const collectIds = (node: any) => {
      const id = node?.$?.properties?.nodeId;
      if (typeof id === 'string') ids.push(id);
      node?.children?.forEach(collectIds);
    };
    collectIds(pending.root);
    expect(ids.filter((id) => id === originalNodeId)).toHaveLength(1);
    expect(new Set(ids).size).toBe(ids.length);
    expect(findProvenance(pending.root, 'generation-1')).toMatchObject({
      generationId: 'generation-1',
      model: 'test-model',
      provider: 'test-provider',
      requestId: 'request-1',
      source: 'ai',
    });

    const firstCommandId = result?.commandId;
    editor.dispatchCommand(LITEXML_REWRITE_RANGE_COMMAND, payload);
    await moment();
    expect(channel?.get('request-1')?.commandId).toBe(firstCommandId);
    expect((editor.getDocument('json') as any).root.children).toHaveLength(1);
    expect(JSON.stringify(pending)).toContain('Hi');
    expect(JSON.stringify(pending)).toContain('Hello world');
    expect(JSON.stringify(pending)).toContain('"rewriteRequestId":"request-1"');
    expect(JSON.stringify(pending)).toContain(`"rewriteCommandId":"${firstCommandId}"`);

    editor.dispatchCommand(LITEXML_DIFFNODE_ALL_COMMAND, { action: DiffAction.Accept });
    await moment();
    const markdown = editor.getDocument('markdown') as unknown as string;
    expect(markdown).toContain('Hi world');
    const accepted = JSON.stringify(editor.getDocument('json'));
    expect(accepted).toContain('generation-1');
    expect(accepted).toContain('request-1');
    expect(reviewEvents).toEqual([
      expect.objectContaining({
        action: 'applied',
        attempt: 1,
        commandId: firstCommandId,
        requestId: 'request-1',
      }),
    ]);
    unsubscribeReview?.();
    lexical.getEditorState().read(() => {
      const paragraph = $getRoot().getFirstChildOrThrow();
      expect($getNodeId(paragraph)).toBe(originalNodeId);
    });
  });

  it('supports reverse selection and preserves inline formatting', async () => {
    editor.setDocument('markdown', '**Hello** world');
    const lexical = editor.getLexicalEditor()!;
    await moment();
    let selection: RangeSelection | undefined;
    let nodeId = '';
    lexical.getEditorState().read(() => {
      const paragraph = $getRoot().getFirstChildOrThrow();
      nodeId = $getNodeId(paragraph) || '';
    });
    lexical.update(() => {
      const paragraph = $getRoot().getFirstChildOrThrow();
      const leaves = textLeaves(paragraph);
      const first = leaves[0];
      if (!$isTextNode(first)) throw new Error('text missing');
      selection = $createRangeSelection();
      selection.anchor.set(first.getKey(), 5, 'text');
      selection.focus.set(first.getKey(), 0, 'text');
      $setSelection(selection);
    });
    await moment();
    editor.dispatchCommand(LITEXML_REWRITE_RANGE_COMMAND, {
      delay: true,
      expectedTextHash: hashRewriteText('Hello'),
      generationId: 'generation-reverse',
      replacementText: 'Hi',
      requestId: 'request-reverse',
      selection: selection!,
    });
    await moment();
    const pending = editor.getDocument('json') as any;
    expect(JSON.stringify(pending)).toContain('Hi');
    expect(JSON.stringify(pending)).toContain('"format":1');
    editor.dispatchCommand(LITEXML_DIFFNODE_ALL_COMMAND, { action: DiffAction.Reject });
    await moment();
    expect(editor.getDocument('markdown')).toContain('Hello');
    lexical.getEditorState().read(() => {
      expect($getNodeId($getRoot().getFirstChildOrThrow())).toBe(nodeId);
    });
  });

  it('coalesces concurrent retries for one request before the result is published', async () => {
    editor.setDocument('markdown', 'Hello world');
    const selection = await selectRange(editor, 0, 0, 0, 5);
    const payload = {
      delay: true,
      expectedTextHash: hashRewriteText('Hello'),
      generationId: 'generation-concurrent',
      replacementText: 'Hi',
      requestId: 'request-concurrent',
      selection,
    } as const;

    // Both dispatches happen before the two-microtask rewrite transaction can
    // publish its result. The second call must not create another Diff.
    editor.dispatchCommand(LITEXML_REWRITE_RANGE_COMMAND, payload);
    editor.dispatchCommand(LITEXML_REWRITE_RANGE_COMMAND, payload);
    await moment();

    const json = editor.getDocument('json') as any;
    const diffCount = JSON.stringify(json).match(/"type":"diff"/g)?.length ?? 0;
    expect(diffCount).toBe(1);
    expect(
      editor.requireService(IRewriteCommandResultService)?.get(payload.requestId),
    ).toMatchObject({
      requestId: payload.requestId,
      status: 'diff-created',
    });
  });

  it('rewrites a range spanning multiple formatted TextNodes while preserving both sides', async () => {
    editor.setDocument('markdown', '**Hello** world');
    await moment();
    const lexical = editor.getLexicalEditor()!;
    let selection: RangeSelection | undefined;
    lexical.update(() => {
      const paragraph = $getRoot().getFirstChildOrThrow();
      const leaves = textLeaves(paragraph);
      const first = leaves[0];
      const second = leaves[1];
      if (!$isTextNode(first) || !$isTextNode(second)) throw new Error('text leaves missing');
      selection = $createRangeSelection();
      selection.anchor.set(first.getKey(), 2, 'text');
      selection.focus.set(second.getKey(), 2, 'text');
      $setSelection(selection);
    });
    await moment();
    editor.dispatchCommand(LITEXML_REWRITE_RANGE_COMMAND, {
      delay: true,
      expectedTextHash: hashRewriteText('llo w'),
      generationId: 'generation-textnodes',
      replacementText: 'X',
      requestId: 'request-textnodes',
      selection: selection!,
    });
    await moment();
    editor.dispatchCommand(LITEXML_DIFFNODE_ALL_COMMAND, { action: DiffAction.Accept });
    await moment();
    const markdown = editor.getDocument('markdown') as unknown as string;
    expect(markdown).toContain('**HeX**orld');
    expect(JSON.stringify(editor.getDocument('json'))).toContain('"format":1');
  });

  it('supports durable block-offset snapshots and cross-paragraph replacement', async () => {
    editor.setDocument('markdown', 'first paragraph\n\nsecond paragraph\n\nthird');
    await moment();
    const lexical = editor.getLexicalEditor()!;
    let ids: string[] = [];
    lexical.getEditorState().read(() => {
      ids = $getRoot()
        .getChildren()
        .map((node) => $getNodeId(node))
        .filter((id): id is string => Boolean(id));
    });
    const selection = {
      type: 'range' as const,
      anchor: { nodeId: ids[0], offset: 6 },
      focus: { nodeId: ids[1], offset: 6 },
    };
    editor.dispatchCommand(LITEXML_REWRITE_RANGE_COMMAND, {
      delay: true,
      expectedTextHash: hashRewriteText('paragraph\nsecond'),
      generationId: 'generation-cross',
      replacementText: 'rewritten',
      requestId: 'request-cross',
      selection,
    });
    await moment();
    const pending = editor.getDocument('json') as any;
    expect(JSON.stringify(pending)).toContain('rewritten');
    expect(JSON.stringify(pending)).toContain('paragraph');
    const allIds: string[] = [];
    const walk = (node: any) => {
      const id = node?.$?.properties?.nodeId;
      if (typeof id === 'string') allIds.push(id);
      node?.children?.forEach(walk);
    };
    walk(pending.root);
    expect(new Set(allIds).size).toBe(allIds.length);
    editor.dispatchCommand(LITEXML_DIFFNODE_ALL_COMMAND, { action: DiffAction.Accept });
    await moment();
    const markdown = editor.getDocument('markdown') as unknown as string;
    expect(markdown).toContain('first rewritten');
    expect(markdown).toContain('paragraph');
    const acceptedIds: string[] = [];
    const collectAcceptedIds = (node: any) => {
      const id = node?.$?.properties?.nodeId;
      if (typeof id === 'string') acceptedIds.push(id);
      node?.children?.forEach(collectAcceptedIds);
    };
    collectAcceptedIds((editor.getDocument('json') as any).root);
    for (const id of ids.slice(0, 2)) {
      expect(acceptedIds.filter((candidate) => candidate === id)).toHaveLength(1);
    }
    expect(new Set(acceptedIds).size).toBe(acceptedIds.length);
  });

  it('accepts inline LiteXML replacement and returns stale for hash drift', async () => {
    editor.setDocument('markdown', 'Hello world');
    const selection = await selectRange(editor, 0, 0, 0, 5);
    editor.dispatchCommand(LITEXML_REWRITE_RANGE_COMMAND, {
      delay: true,
      expectedTextHash: hashRewriteText('different'),
      generationId: 'generation-stale',
      replacementText: 'Nope',
      requestId: 'request-stale',
      selection,
    });
    await moment();
    expect(editor.requireService(IRewriteCommandResultService)?.get('request-stale')?.status).toBe(
      'stale',
    );
    editor.setDocument('markdown', 'Hello world');
    const xmlSelection = await selectRange(editor, 0, 0, 0, 5);
    editor.dispatchCommand(LITEXML_REWRITE_RANGE_COMMAND, {
      delay: true,
      expectedTextHash: hashRewriteText('Hello'),
      generationId: 'generation-xml',
      replacementLiteXML: '<span bold="true">Hi</span>',
      requestId: 'request-xml',
      selection: xmlSelection,
    });
    await moment();
    expect(editor.requireService(IRewriteCommandResultService)?.get('request-xml')?.status).toBe(
      'diff-created',
    );
    expect(JSON.stringify(editor.getDocument('json'))).toContain('Hi');
  });

  it('supports a single list item rewrite with listItemModify review', async () => {
    editor.setDocument('markdown', '- Hello world');
    await moment();
    const lexical = editor.getLexicalEditor()!;
    let selection: RangeSelection | undefined;
    lexical.update(() => {
      const list = $getRoot().getFirstChildOrThrow();
      if (!$isElementNode(list)) throw new Error('list missing');
      const item = list.getFirstChild();
      if (!item || !$isElementNode(item)) throw new Error('list item missing');
      const text = textLeaves(item)[0];
      if (!$isTextNode(text)) throw new Error('list item text missing');
      selection = $createRangeSelection();
      selection.anchor.set(text.getKey(), 0, 'text');
      selection.focus.set(text.getKey(), 5, 'text');
      $setSelection(selection);
    });
    await moment();
    editor.dispatchCommand(LITEXML_REWRITE_RANGE_COMMAND, {
      delay: true,
      expectedTextHash: hashRewriteText('Hello'),
      generationId: 'generation-list',
      replacementText: 'Hi',
      requestId: 'request-list',
      selection: selection!,
    });
    await moment();
    const pending = editor.getDocument('json') as any;
    expect(JSON.stringify(pending)).toContain('listItemModify');
    expect(JSON.stringify(pending)).toContain('Hi');
    editor.dispatchCommand(LITEXML_DIFFNODE_ALL_COMMAND, { action: DiffAction.Accept });
    await moment();
    expect(editor.getDocument('markdown')).toContain('- Hi world');
  });

  it('supports full-block and empty replacements without losing the block shape', async () => {
    editor.setDocument('markdown', 'Replace me');
    const selection = await selectRange(editor, 0, 0, 0, 10);
    editor.dispatchCommand(LITEXML_REWRITE_RANGE_COMMAND, {
      delay: true,
      expectedTextHash: hashRewriteText('Replace me'),
      generationId: 'generation-full',
      replacementText: '',
      requestId: 'request-full',
      selection,
    });
    await moment();
    expect(JSON.stringify(editor.getDocument('json'))).toContain('diff');
    editor.dispatchCommand(LITEXML_DIFFNODE_ALL_COMMAND, { action: DiffAction.Accept });
    await moment();
    const accepted = editor.getDocument('json') as any;
    expect(accepted.root.children[0].type).toBe('paragraph');
    expect(accepted.root.children[0].children).toHaveLength(0);
  });

  it('rejects non-delayed or ambiguous replacement payloads without a document mutation', async () => {
    editor.setDocument('markdown', 'Hello world');
    const selection = await selectRange(editor, 0, 0, 0, 5);
    const before = JSON.stringify(editor.getDocument('json'));
    editor.dispatchCommand(LITEXML_REWRITE_RANGE_COMMAND, {
      delay: false as true,
      expectedTextHash: hashRewriteText('Hello'),
      generationId: 'generation-invalid-delay',
      replacementText: 'Hi',
      requestId: 'request-invalid-delay',
      selection,
    });
    await moment();
    expect(
      editor.requireService(IRewriteCommandResultService)?.get('request-invalid-delay'),
    ).toMatchObject({ status: 'failed' });
    editor.dispatchCommand(LITEXML_REWRITE_RANGE_COMMAND, {
      delay: true,
      expectedTextHash: hashRewriteText('Hello'),
      generationId: 'generation-invalid-replacement',
      replacementLiteXML: '<span>XML</span>',
      replacementText: 'Text',
      requestId: 'request-invalid-replacement',
      selection,
    });
    await moment();
    expect(
      editor.requireService(IRewriteCommandResultService)?.get('request-invalid-replacement'),
    ).toMatchObject({ status: 'failed' });
    expect(JSON.stringify(editor.getDocument('json'))).toBe(before);
  });

  it('returns stale when the durable anchor is deleted before command execution', async () => {
    editor.setDocument('markdown', 'Delete me');
    await moment();
    const lexical = editor.getLexicalEditor()!;
    let selection: RangeSelection | undefined;
    lexical.update(() => {
      const paragraph = $getRoot().getFirstChildOrThrow();
      if (!$isElementNode(paragraph)) throw new Error('paragraph missing');
      const text = paragraph.getFirstChild();
      if (!$isTextNode(text)) throw new Error('text missing');
      selection = $createRangeSelection();
      selection.anchor.set(text.getKey(), 0, 'text');
      selection.focus.set(text.getKey(), 6, 'text');
      $setSelection(selection);
    });
    await moment();
    lexical.update(() => {
      $getRoot().getFirstChildOrThrow().remove();
    });
    await moment();
    editor.dispatchCommand(LITEXML_REWRITE_RANGE_COMMAND, {
      delay: true,
      expectedTextHash: hashRewriteText('Delete'),
      generationId: 'generation-deleted',
      replacementText: 'Nope',
      requestId: 'request-deleted',
      selection: selection!,
    });
    await moment();
    expect(
      editor.requireService(IRewriteCommandResultService)?.get('request-deleted'),
    ).toMatchObject({
      status: 'stale',
    });
  });

  it('supports undo after accepting the collaborative diff', async () => {
    editor.setDocument('markdown', 'Undo me');
    const selection = await selectRange(editor, 0, 0, 0, 4);
    editor.dispatchCommand(LITEXML_REWRITE_RANGE_COMMAND, {
      delay: true,
      expectedTextHash: hashRewriteText('Undo'),
      generationId: 'generation-undo',
      replacementText: 'Redo',
      requestId: 'request-undo',
      selection,
    });
    await moment();
    editor.dispatchCommand(LITEXML_DIFFNODE_ALL_COMMAND, { action: DiffAction.Accept });
    await moment();
    expect(editor.getDocument('markdown')).toContain('Redo me');
    editor.dispatchCommand(UNDO_COMMAND, undefined);
    await moment();
    expect(editor.getDocument('markdown')).toContain('Undo me');
  });

  it('rejects table and ambiguous replacement targets before mutating', async () => {
    editor.setDocument('markdown', '| Hello |\n| --- |');
    await moment();
    const lexical = editor.getLexicalEditor()!;
    let tableSelection: RangeSelection | undefined;
    lexical.update(() => {
      const table = $getRoot().getFirstChildOrThrow();
      if (!$isElementNode(table)) throw new Error('table missing');
      const cell = table.getFirstDescendant();
      if (!$isTextNode(cell)) throw new Error('cell text missing');
      tableSelection = $createRangeSelection();
      tableSelection.anchor.set(cell.getKey(), 0, 'text');
      tableSelection.focus.set(cell.getKey(), 5, 'text');
      $setSelection(tableSelection);
    });
    await moment();
    const tableText = lexical.getEditorState().read(() => {
      const current = $getSelection();
      return $isRangeSelection(current) ? current.getTextContent() : '';
    });
    editor.dispatchCommand(LITEXML_REWRITE_RANGE_COMMAND, {
      delay: true,
      expectedTextHash: hashRewriteText(tableText),
      generationId: 'generation-table',
      replacementText: 'Nope',
      requestId: 'request-table',
      selection: tableSelection!,
    });
    await moment();
    expect(editor.requireService(IRewriteCommandResultService)?.get('request-table')?.status).toBe(
      'failed',
    );
  });

  it('routes Agent mutations through the allowlist and rejects raw/runtime-key commands', async () => {
    editor.setDocument('markdown', 'Hello world');
    await moment();
    const lexical = editor.getLexicalEditor()!;
    const channel = editor.requireService(IRewriteCommandResultService)!;
    const gateway = createCollaborativeAgentCommandGateway(lexical, channel);
    const selection = await selectRange(editor, 0, 0, 0, 5);
    const rewrite = await gateway.dispatch(LITEXML_REWRITE_RANGE_COMMAND, {
      delay: true,
      expectedTextHash: hashRewriteText('Hello'),
      generationId: 'generation-gateway',
      replacementText: 'Hi',
      requestId: 'request-gateway',
      selection,
    });
    expect(rewrite.status).toBe('diff-created');
    expect(
      (
        await gateway.dispatch(LITEXML_REWRITE_RANGE_COMMAND, {
          ...rewrite,
          delay: true,
          expectedTextHash: hashRewriteText('Hello'),
          generationId: 'generation-invalid-selection',
          requestId: 'request-invalid-selection',
          selection: (() => {}) as never,
        })
      ).error,
    ).toBe('invalid-rewrite-payload');
    const unknown = createCommand<unknown>('UNKNOWN_AGENT_COMMAND');
    expect((await gateway.dispatch(unknown, {})).error).toBe('command-not-allowlisted');
    expect(
      (
        await gateway.dispatch(LITEXML_INSERT_COMMAND, {
          afterId: 'stable-node-id',
          litexml: '<p>Inserted</p>',
          nodeKey: 'ephemeral',
        })
      ).error,
    ).toBe('runtime-nodeKey-forbidden');
    expect(
      (
        await gateway.dispatch(LITEXML_INSERT_COMMAND, {
          litexml: '<p>Inserted</p>',
        })
      ).error,
    ).toBe('exactly-one-insert-target-required');
    expect(
      (
        await gateway.dispatch(LITEXML_MODIFY_COMMAND, [
          { action: 'modify', litexml: '<p id="ll63">Legacy key</p>' },
        ])
      ).error,
    ).toBe('stable-modify-target-required');
  });

  it('accepts a stable MODIFY array and keeps the mutation behind a delayed diff', async () => {
    editor.setDocument('markdown', 'First paragraph\n\nSecond paragraph');
    await moment();
    const lexical = editor.getLexicalEditor()!;
    const ids: string[] = [];
    lexical.getEditorState().read(() => {
      $getRoot()
        .getChildren()
        .forEach((node) => {
          const id = $getNodeId(node);
          if (id) ids.push(id);
        });
    });
    expect(ids).toHaveLength(2);

    const gateway = createCollaborativeAgentCommandGateway(
      lexical,
      editor.requireService(IRewriteCommandResultService)!,
    );
    const requestId = 'request-gateway-modify';
    const operations = [
      {
        action: 'modify',
        litexml: `<p id="${ids[0]}"><span>Rewritten paragraph</span></p>`,
      },
    ];
    Object.defineProperties(operations, {
      attempt: { value: 2 },
      commandId: { value: 'command-gateway-modify' },
      generationId: { value: 'generation-gateway-modify' },
      model: { value: 'test-model' },
      provider: { value: 'test-provider' },
      requestId: { value: requestId },
    });
    const rewrite = await gateway.dispatch(LITEXML_MODIFY_COMMAND, operations);

    expect(rewrite).toMatchObject({
      affectedNodeIds: [ids[0]],
      commandId: 'command-gateway-modify',
      requestId,
      status: 'diff-created',
    });
    await moment();
    const projected = JSON.stringify(editor.getDocument('json'));
    expect(projected).toContain('Rewritten paragraph');
    expect(projected).toContain('First paragraph');
    expect(projected).toContain('"diff"');
    expect(projected).toContain('"rewriteRequestId":"request-gateway-modify"');
    expect(projected).toContain('"rewriteCommandId":"command-gateway-modify"');
    expect(projected).toContain('"rewriteAttempt":2');
    expect(projected).toContain('"generationId":"generation-gateway-modify"');
    expect(projected).toContain('"model":"test-model"');
    expect(projected).toContain('"provider":"test-provider"');
    expect(projected).toContain('"source":"ai"');

    editor.dispatchCommand(LITEXML_DIFFNODE_ALL_COMMAND, { action: DiffAction.Reject });
    await moment();
    expect(editor.getDocument('markdown')).toContain('First paragraph');
  });

  it('reports real insert/remove handling and forces both Agent commands to delayed diffs', async () => {
    editor.setDocument('markdown', 'First paragraph\n\nSecond paragraph');
    await moment();
    const lexical = editor.getLexicalEditor()!;
    const ids: string[] = [];
    lexical.getEditorState().read(() => {
      $getRoot()
        .getChildren()
        .forEach((node) => {
          const id = $getNodeId(node);
          if (id) ids.push(id);
        });
    });
    const gateway = createCollaborativeAgentCommandGateway(
      lexical,
      editor.requireService(IRewriteCommandResultService)!,
    );

    const insert = await gateway.dispatch(LITEXML_INSERT_COMMAND, {
      afterId: ids[0],
      attempt: 3,
      commandId: 'command-gateway-insert',
      generationId: 'generation-gateway-insert',
      litexml: '<p><span>Inserted paragraph</span></p>',
      model: 'insert-model',
      provider: 'insert-provider',
      requestId: 'request-gateway-insert',
    });
    expect(insert).toMatchObject({
      affectedNodeIds: [ids[0]],
      commandId: 'command-gateway-insert',
      requestId: 'request-gateway-insert',
      status: 'diff-created',
    });
    await moment();
    const inserted = JSON.stringify(editor.getDocument('json'));
    expect(inserted).toContain('Inserted paragraph');
    expect(inserted).toContain('"diff"');
    expect(inserted).toContain('"rewriteRequestId":"request-gateway-insert"');
    expect(inserted).toContain('"rewriteCommandId":"command-gateway-insert"');
    expect(inserted).toContain('"rewriteAttempt":3');
    expect(inserted).toContain('"generationId":"generation-gateway-insert"');
    expect(inserted).toContain('"source":"ai"');

    const remove = await gateway.dispatch(LITEXML_REMOVE_COMMAND, {
      attempt: 4,
      commandId: 'command-gateway-remove',
      generationId: 'generation-gateway-remove',
      id: ids[1],
      model: 'remove-model',
      provider: 'remove-provider',
      requestId: 'request-gateway-remove',
    });
    expect(remove).toMatchObject({
      affectedNodeIds: [ids[1]],
      commandId: 'command-gateway-remove',
      requestId: 'request-gateway-remove',
      status: 'diff-created',
    });
    await moment();
    const removed = JSON.stringify(editor.getDocument('json'));
    expect(removed).toContain('Second paragraph');
    expect(removed).toContain('"diff"');
    expect(removed).toContain('"rewriteRequestId":"request-gateway-remove"');
    expect(removed).toContain('"rewriteCommandId":"command-gateway-remove"');
    expect(removed).toContain('"rewriteAttempt":4');
    expect(removed).toContain('"generationId":"generation-gateway-remove"');
    expect(removed).toContain('"source":"ai"');

    const missing = await gateway.dispatch(LITEXML_REMOVE_COMMAND, {
      id: '00000000-0000-4000-8000-000000000000',
    });
    expect(missing).toMatchObject({ error: 'command-not-handled', status: 'failed' });
  });

  it('rejects unsafe LiteXML before any rewrite mutation', async () => {
    expect(validateLiteXMLInput('<a href="javascript:alert(1)">unsafe</a>')).toBe(
      'replacement-litexml-unsafe-url',
    );
    expect(validateLiteXMLInput('<a href="data:text/html,unsafe">unsafe</a>')).toBe(
      'replacement-litexml-unsafe-url',
    );
    expect(validateLiteXMLInput('<a href="javascript&amp;colon;alert(1)">unsafe</a>')).toBe(
      'replacement-litexml-unsafe-url',
    );
    expect(validateLiteXMLInput('<script>alert(1)</script>')).toBe(
      'replacement-litexml-unknown-node',
    );
    expect(validateLiteXMLInput('<p onclick="alert(1)">unsafe</p>')).toBe(
      'replacement-litexml-attribute-not-allowed',
    );
    expect(validateLiteXMLInput('<p>&xxe;</p>')).toBe('replacement-litexml-entity-forbidden');
    expect(validateLiteXMLInput('<!DOCTYPE root><p>unsafe</p>')).toBe(
      'replacement-litexml-entity-forbidden',
    );
    expect(validateLiteXMLInput('<p><unknown>unsafe</unknown></p>')).toBe(
      'replacement-litexml-unknown-node',
    );
    expect(validateLiteXMLInput(`<a href="${'x'.repeat(9_000)}">too large</a>`)).toBe(
      'replacement-litexml-attribute-too-large',
    );

    const deep = '<p>'.repeat(40) + 'deep' + '</p>'.repeat(40);
    expect(validateLiteXMLInput(deep)).toBe('replacement-litexml-too-deep');
    const manyNodes = `<p>${'<span>x</span>'.repeat(260)}</p>`;
    expect(validateLiteXMLInput(manyNodes)).toBe('replacement-litexml-too-many-nodes');
    const hugeAttribute = `<span>${'x'.repeat(1_048_600)}</span>`;
    expect(validateLiteXMLInput(hugeAttribute)).toBe('replacement-litexml-too-large');

    editor.setDocument('markdown', 'Hello world');
    const selection = await selectRange(editor, 0, 0, 0, 5);
    const before = JSON.stringify(editor.getDocument('json'));
    editor.dispatchCommand(LITEXML_REWRITE_RANGE_COMMAND, {
      delay: true,
      expectedTextHash: hashRewriteText('Hello'),
      generationId: 'generation-unsafe-xml',
      replacementLiteXML: '<a href="javascript:alert(1)">bad</a>',
      requestId: 'request-unsafe-xml',
      selection,
    });
    await moment();
    expect(
      editor.requireService(IRewriteCommandResultService)?.get('request-unsafe-xml'),
    ).toMatchObject({
      error: 'replacement-litexml-unsafe-url',
      status: 'failed',
    });
    expect(JSON.stringify(editor.getDocument('json'))).toBe(before);
  });

  it('uses isolated preflight semantics and reports only newly introduced nested diffs', () => {
    const clean = { root: { type: 'root', children: [] } } as any;
    const nested = {
      root: {
        type: 'root',
        children: [
          {
            type: 'diff',
            diffType: 'modify',
            children: [{ type: 'diff', diffType: 'remove', children: [] }],
          },
        ],
      },
    } as any;
    expect(findNewIllegalDiffPaths(clean, nested)).toHaveLength(1);
    expect(findNewIllegalDiffPaths(nested, nested)).toEqual([]);

    const validDiffContent = {
      root: {
        type: 'root',
        children: [
          {
            type: 'diff',
            diffType: 'modify',
            children: [
              {
                type: 'diff-content',
                side: 'before',
                children: [{ type: 'paragraph', children: [] }],
              },
              {
                type: 'diff-content',
                side: 'after',
                children: [{ type: 'paragraph', children: [] }],
              },
            ],
          },
        ],
      },
    } as any;
    expect(collectIllegalNestedDiffPaths(validDiffContent.root)).toEqual([]);

    const projectedWithOneMoreViolation = {
      root: {
        type: 'root',
        children: [
          {
            type: 'diff',
            diffType: 'modify',
            children: [
              { type: 'diff', diffType: 'remove', children: [] },
              { type: 'diff', diffType: 'add', children: [] },
            ],
          },
        ],
      },
    } as any;
    expect(findNewIllegalDiffPaths(nested, projectedWithOneMoreViolation)).toHaveLength(1);
  });
});
