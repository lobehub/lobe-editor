import { $getRoot } from 'lexical';
import { beforeEach, describe, expect, it } from 'vitest';

import Editor, { moment } from '@/editor-kernel';
import {
  DiffAction,
  IRewriteCommandResultService,
  IRewriteReviewService,
  LITEXML_MODIFY_COMMAND,
  LITEXML_REVIEW_COMMAND,
  LitexmlPlugin,
} from '@/plugins/litexml';
import { CommonPlugin } from '@/plugins/common';
import { MarkdownPlugin } from '@/plugins/markdown';
import { PropertiesPlugin } from '@/plugins/properties';
import { $getNodeId } from '@/plugins/properties/utils';
import { createCollaborativeAgentCommandGateway } from '@/plugins/litexml/command/gateway';

describe('LITEXML_REVIEW_COMMAND', () => {
  let editor: ReturnType<typeof Editor.createEditor>;

  beforeEach(() => {
    editor = Editor.createEditor();
    editor.registerPlugins([CommonPlugin, MarkdownPlugin, LitexmlPlugin, PropertiesPlugin]);
    editor.initNodeEditor();
  });

  it('accepts only the matching attempt and treats a settled review as an idempotent no-op', async () => {
    editor.setDocument('markdown', 'Before paragraph');
    await moment();
    const lexical = editor.getLexicalEditor()!;
    let sourceId = '';
    lexical.getEditorState().read(() => {
      sourceId = $getNodeId($getRoot().getFirstChildOrThrow()) || '';
    });

    const channel = editor.requireService(IRewriteCommandResultService)!;
    const reviewEvents: unknown[] = [];
    const unsubscribe = channel.subscribeReview?.((event) => reviewEvents.push(event));
    const gateway = createCollaborativeAgentCommandGateway(lexical, channel);
    const operations = [
      {
        action: 'modify' as const,
        litexml: `<p id="${sourceId}">After paragraph</p>`,
      },
    ];
    Object.defineProperties(operations, {
      attempt: { value: 3 },
      commandId: { value: 'review-command-1' },
      generationId: { value: 'review-generation-1' },
      requestId: { value: 'review-request-1' },
    });

    const rewrite = await gateway.dispatch(LITEXML_MODIFY_COMMAND, operations);
    expect(rewrite).toMatchObject({
      commandId: 'review-command-1',
      requestId: 'review-request-1',
      status: 'diff-created',
    });
    await moment();

    const reviewService = editor.requireService(IRewriteReviewService)!;
    expect(reviewService.listPendingReviews()).toEqual([
      expect.objectContaining({
        attempt: 3,
        commandId: 'review-command-1',
        diffCount: 1,
        requestId: 'review-request-1',
      }),
    ]);

    expect(
      lexical.dispatchCommand(LITEXML_REVIEW_COMMAND, {
        action: DiffAction.Accept,
        commandId: 'review-command-1',
        requestId: 'review-request-1',
      }),
    ).toBe(true);
    await moment();
    expect(JSON.stringify(editor.getDocument('json'))).toContain('"diffType":"modify"');
    expect(reviewEvents).toHaveLength(0);

    const settled = await reviewService.settleReview({
      attempt: 3,
      commandId: 'review-command-1',
      requestId: 'review-request-1',
      status: 'applied',
    });
    expect(settled).toMatchObject({
      affectedNodeIds: [sourceId],
      attempt: 3,
      commandId: 'review-command-1',
      requestId: 'review-request-1',
      status: 'applied',
    });
    await moment();
    expect(editor.getDocument('markdown')).toContain('After paragraph');
    expect(editor.getDocument('markdown')).not.toContain('Before paragraph');
    expect(reviewEvents).toEqual([
      {
        action: 'applied',
        attempt: 3,
        commandId: 'review-command-1',
        requestId: 'review-request-1',
      },
    ]);

    // A remote client may have settled the same diff first. Repeating the
    // durable command must not emit a second review event or mutate text.
    expect(
      lexical.dispatchCommand(LITEXML_REVIEW_COMMAND, {
        action: DiffAction.Accept,
        attempt: 3,
        commandId: 'review-command-1',
        requestId: 'review-request-1',
      }),
    ).toBe(true);
    await moment();
    expect(reviewEvents).toHaveLength(1);
    unsubscribe?.();
  });

  it('settles every matching diff wrapper in one transaction and rejects mismatched identity', async () => {
    editor.setDocument('markdown', 'First paragraph\n\nSecond paragraph');
    await moment();
    const lexical = editor.getLexicalEditor()!;
    const sourceIds: string[] = [];
    lexical.getEditorState().read(() => {
      $getRoot()
        .getChildren()
        .forEach((node) => {
          const nodeId = $getNodeId(node);
          if (nodeId) sourceIds.push(nodeId);
        });
    });
    const channel = editor.requireService(IRewriteCommandResultService)!;
    const reviewEvents: unknown[] = [];
    const unsubscribe = channel.subscribeReview?.((event) => reviewEvents.push(event));
    const gateway = createCollaborativeAgentCommandGateway(lexical, channel);
    const operations = sourceIds.map((sourceId, index) => ({
      action: 'modify' as const,
      litexml: `<p id="${sourceId}">After ${index + 1}</p>`,
    }));
    Object.defineProperties(operations, {
      attempt: { value: 1 },
      commandId: { value: 'review-command-multi' },
      generationId: { value: 'review-generation-multi' },
      requestId: { value: 'review-request-multi' },
    });
    const rewrite = await gateway.dispatch(LITEXML_MODIFY_COMMAND, operations);
    expect(rewrite.status).toBe('diff-created');
    await moment();

    lexical.dispatchCommand(LITEXML_REVIEW_COMMAND, {
      action: DiffAction.Reject,
      attempt: 1,
      commandId: 'wrong-command',
      requestId: 'review-request-multi',
    });
    await moment();
    const pending = JSON.stringify(editor.getDocument('json'));
    expect(pending).toContain('After 1');
    expect(pending).toContain('After 2');

    lexical.dispatchCommand(LITEXML_REVIEW_COMMAND, {
      action: DiffAction.Reject,
      attempt: 1,
      commandId: 'review-command-multi',
      requestId: 'review-request-multi',
    });
    await moment();
    expect(editor.getDocument('markdown')).toContain('First paragraph');
    expect(editor.getDocument('markdown')).toContain('Second paragraph');
    expect(editor.getDocument('markdown')).not.toContain('After 1');
    expect(editor.getDocument('markdown')).not.toContain('After 2');
    expect(reviewEvents).toHaveLength(1);
    expect(reviewEvents[0]).toEqual({
      action: 'rejected',
      attempt: 1,
      commandId: 'review-command-multi',
      requestId: 'review-request-multi',
    });
    unsubscribe?.();
  });
});
