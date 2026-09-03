import {
  $createRangeSelection,
  $getRoot,
  $isElementNode,
  $isTextNode,
  $setSelection,
  type RangeSelection,
} from 'lexical';
import { beforeEach, describe, expect, it } from 'vitest';

import Editor, { moment } from '@/editor-kernel';
import { CommonPlugin } from '@/plugins/common';
import {
  IRewriteCommandResultService,
  LITEXML_REWRITE_RANGE_COMMAND,
  LitexmlPlugin,
} from '@/plugins/litexml';
import { hashRewriteText } from '@/plugins/litexml/command';
import { $getNodeId } from '@/plugins/properties/utils';
import { MarkdownPlugin } from '@/plugins/markdown';
import { PropertiesPlugin } from '@/plugins/properties';
import type { IEditor } from '@/types';

const textLeaves = (node: any): any[] => {
  if ($isTextNode(node)) return [node];
  if (!$isElementNode(node)) return [];
  return node.getChildren().flatMap(textLeaves);
};

async function selectRange(
  editor: IEditor,
  startBlockIndex: number,
  startOffset: number,
  endBlockIndex: number,
  endOffset: number,
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
    const end = startBlock === endBlock ? start : endLeaves.at(-1);
    if (!$isTextNode(start) || !$isTextNode(end)) throw new Error('selection text missing');
    selection = $createRangeSelection();
    selection.anchor.set(start.getKey(), startOffset, 'text');
    selection.focus.set(end.getKey(), endOffset, 'text');
    $setSelection(selection);
  });
  await moment();
  if (!selection) throw new Error('selection not created');
  return selection;
}

describe('direct collaborative range rewrite', () => {
  let editor: IEditor;

  beforeEach(() => {
    editor = Editor.createEditor();
    editor.registerPlugins([CommonPlugin, MarkdownPlugin, LitexmlPlugin, PropertiesPlugin]);
    editor.initNodeEditor();
  });

  it('applies one paragraph directly and keeps the durable block id/provenance', async () => {
    editor.setDocument('markdown', 'Hello world');
    await moment();
    const lexical = editor.getLexicalEditor()!;
    let blockId = '';
    lexical.getEditorState().read(() => {
      blockId = $getNodeId($getRoot().getFirstChildOrThrow()) || '';
    });
    const selection = await selectRange(editor, 0, 0, 0, 5);

    editor.dispatchCommand(LITEXML_REWRITE_RANGE_COMMAND, {
      expectedTextHash: hashRewriteText('Hello'),
      generationId: 'direct-generation-single',
      mode: 'direct',
      replacementText: 'Hi',
      requestId: 'direct-request-single',
      selection,
    });
    await moment();

    expect(
      editor.requireService(IRewriteCommandResultService)?.get('direct-request-single'),
    ).toEqual(
      expect.objectContaining({
        affectedNodeIds: [blockId],
        status: 'applied',
      }),
    );
    expect(editor.getDocument('markdown')).toContain('Hi world');
    const json = JSON.stringify(editor.getDocument('json'));
    expect(json).not.toContain('"type":"diff"');
    expect(json).toContain('direct-generation-single');
    lexical.getEditorState().read(() => {
      expect($getNodeId($getRoot().getFirstChildOrThrow())).toBe(blockId);
    });
  });

  it('rewrites cross-block ranges without wrapping either block in a Diff node', async () => {
    editor.setDocument('markdown', 'first paragraph\n\nsecond paragraph\n\nthird');
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
    const selection = {
      anchor: { nodeId: ids[0], offset: 6 },
      focus: { nodeId: ids[1], offset: 6 },
      quotedText: 'paragraph second',
      quotedTextHash: hashRewriteText('paragraph second'),
      targetNodeIds: ids.slice(0, 2),
      type: 'range' as const,
    };

    lexical.dispatchCommand(LITEXML_REWRITE_RANGE_COMMAND, {
      expectedTextHash: hashRewriteText('paragraph second'),
      generationId: 'direct-generation-cross',
      mode: 'direct',
      replacementText: 'rewritten',
      requestId: 'direct-request-cross',
      selection,
    });
    await moment();

    expect(editor.getDocument('markdown')).toContain('first rewritten');
    expect(editor.getDocument('markdown')).toContain('paragraph');
    const json = JSON.stringify(editor.getDocument('json'));
    expect(json).not.toContain('"type":"diff"');
    expect(
      editor.requireService(IRewriteCommandResultService)?.get('direct-request-cross'),
    ).toEqual(expect.objectContaining({ affectedNodeIds: ids.slice(0, 2), status: 'applied' }));
  });

  it('keeps genuine cross-block content drift stale after separator normalization', async () => {
    editor.setDocument('markdown', 'first paragraph\n\nsecond paragraph');
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
    const selection = {
      anchor: { nodeId: ids[0], offset: 0 },
      focus: { nodeId: ids[1], offset: 6 },
      quotedText: 'first paragraph second',
      quotedTextHash: hashRewriteText('first paragraph second'),
      targetNodeIds: ids,
      type: 'range' as const,
    };
    lexical.update(() => {
      const text = textLeaves($getRoot().getFirstChildOrThrow())[0];
      if (!$isTextNode(text)) throw new Error('first text missing');
      text.setTextContent('changed paragraph');
    });
    await moment();

    lexical.dispatchCommand(LITEXML_REWRITE_RANGE_COMMAND, {
      expectedTextHash: hashRewriteText('first paragraph second'),
      generationId: 'direct-generation-drift',
      mode: 'direct',
      replacementText: 'should-not-apply',
      requestId: 'direct-request-drift',
      selection,
    });
    await moment();

    expect(
      editor.requireService(IRewriteCommandResultService)?.get('direct-request-drift'),
    ).toEqual(expect.objectContaining({ status: 'stale' }));
    expect(editor.getDocument('markdown')).toContain('changed paragraph');
    expect(JSON.stringify(editor.getDocument('json'))).not.toContain('"type":"diff"');
  });

  it('preserves inline formatting and rejects a second stale concurrent rewrite', async () => {
    editor.setDocument('markdown', '**Hello** world');
    await moment();
    const selection = await selectRange(editor, 0, 0, 0, 5);
    const lexical = editor.getLexicalEditor()!;
    const first = {
      expectedTextHash: hashRewriteText('Hello'),
      generationId: 'direct-generation-format',
      mode: 'direct' as const,
      replacementText: 'Hi',
      requestId: 'direct-request-format',
      selection,
    };
    const second = {
      ...first,
      generationId: 'direct-generation-stale',
      replacementText: 'Bye',
      requestId: 'direct-request-stale',
    };
    lexical.dispatchCommand(LITEXML_REWRITE_RANGE_COMMAND, first);
    lexical.dispatchCommand(LITEXML_REWRITE_RANGE_COMMAND, second);
    await moment();

    expect(editor.getDocument('markdown')).toContain('**Hi** world');
    expect(editor.requireService(IRewriteCommandResultService)?.get(first.requestId)?.status).toBe(
      'applied',
    );
    expect(editor.requireService(IRewriteCommandResultService)?.get(second.requestId)).toEqual(
      expect.objectContaining({ status: 'stale' }),
    );
    const json = JSON.stringify(editor.getDocument('json'));
    expect(json).not.toContain('"type":"diff"');
    expect(json).toContain('"format":1');
  });

  it('accepts a validated inline LiteXML replacement without creating a Diff', async () => {
    editor.setDocument('markdown', 'Hello world');
    await moment();
    const selection = await selectRange(editor, 0, 0, 0, 5);
    const lexical = editor.getLexicalEditor()!;

    lexical.dispatchCommand(LITEXML_REWRITE_RANGE_COMMAND, {
      expectedTextHash: hashRewriteText('Hello'),
      generationId: 'direct-generation-xml',
      mode: 'direct',
      replacementLiteXML: '<span bold="true">Hi</span>',
      requestId: 'direct-request-xml',
      selection,
    });
    await moment();

    expect(editor.requireService(IRewriteCommandResultService)?.get('direct-request-xml')).toEqual(
      expect.objectContaining({ status: 'applied' }),
    );
    expect(editor.getDocument('markdown')).toContain('**Hi** world');
    const json = JSON.stringify(editor.getDocument('json'));
    expect(json).not.toContain('"type":"diff"');
    expect(json).toContain('direct-generation-xml');
  });
});
