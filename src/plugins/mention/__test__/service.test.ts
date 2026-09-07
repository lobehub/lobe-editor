// @vitest-environment node
import {
  $getRoot,
  $getSelection,
  $insertNodes,
  $isElementNode,
  $isRangeSelection,
  $isTextNode,
  UNDO_COMMAND,
} from 'lexical';
import { afterEach, describe, expect, it, vi } from 'vitest';

import Editor from '@/editor-kernel';
import { CommonPlugin } from '@/plugins/common';
import { MarkdownPlugin } from '@/plugins/markdown';
import type { IEditor } from '@/types';

import { INSERT_MENTION_COMMAND, type MentionDescriptor, MentionPlugin } from '..';
import { $createMentionNode, type MentionNode } from '../node/MentionNode';
import { IMentionService } from '../service';

const editors: IEditor[] = [];
const nextTick = () => new Promise((resolve) => setTimeout(resolve, 0));

const createEditor = (): IEditor => {
  const editor = Editor.createEditor().registerPlugins([
    CommonPlugin,
    MarkdownPlugin,
    MentionPlugin,
  ]);
  editor.initNodeEditor();
  editors.push(editor);
  return editor;
};

afterEach(() => {
  editors.splice(0).forEach((editor: IEditor) => editor.destroy());
});

describe('MentionService', () => {
  it('queries nested mentions in document order and keeps duplicate occurrences', () => {
    const editor = createEditor();
    editor.setDocument('json', {
      root: {
        children: [
          {
            children: [
              {
                children: [
                  {
                    label: 'Alice',
                    metadata: { id: 'alice', profile: { team: 'design' } },
                    type: 'mention',
                    version: 1,
                  },
                ],
                type: 'paragraph',
                version: 1,
              },
            ],
            type: 'quote',
            version: 1,
          },
          {
            children: [
              {
                label: 'Alice again',
                metadata: { id: 'alice', profile: { team: 'design' } },
                type: 'mention',
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
    });

    const service = editor.requireService(IMentionService)!;
    expect(service.getMentions()).toEqual([
      { label: 'Alice', metadata: { id: 'alice', profile: { team: 'design' } } },
      { label: 'Alice again', metadata: { id: 'alice', profile: { team: 'design' } } },
    ]);

    const snapshot = service.getMentions();
    (snapshot[0].metadata.profile as { team: string }).team = 'changed';
    expect((service.getMentions()[0].metadata.profile as { team: string }).team).toBe('design');
  });

  it('notifies after commit so document and service snapshots include the inserted node', async () => {
    const editor = createEditor();
    const service = editor.requireService(IMentionService)!;
    const observed: Array<{
      document: any;
      mentions: ReturnType<typeof service.getMentions>;
    }> = [];

    service.subscribe((mention: MentionDescriptor) => {
      const committedState = editor.getLexicalEditor()!.getEditorState().toJSON();
      observed.push({
        document: editor.getDocument('json'),
        mentions: service.getMentions(),
      });
      expect(mention).toEqual({ label: 'Alice', metadata: { id: 'alice' } });
      expect(findSerializedMentions(committedState)).toEqual([
        { label: 'Alice', metadata: { id: 'alice' } },
      ]);
    });

    editor.dispatchCommand(INSERT_MENTION_COMMAND, {
      label: 'Alice',
      metadata: { id: 'alice' },
    });
    await nextTick();

    expect(observed).toHaveLength(1);
    expect(observed[0].mentions).toEqual([{ label: 'Alice', metadata: { id: 'alice' } }]);
    expect(findSerializedMentions(observed[0].document)).toEqual([
      { label: 'Alice', metadata: { id: 'alice' } },
    ]);
  });

  it('emits each successful insertion once in a batched update', async () => {
    const editor = createEditor();
    const service = editor.requireService(IMentionService)!;
    const inserted: string[] = [];
    service.subscribe((mention: MentionDescriptor) => inserted.push(mention.label));

    editor.getLexicalEditor()!.update(() => {
      $getRoot().selectEnd();
      editor.dispatchCommand(INSERT_MENTION_COMMAND, {
        label: 'Alice',
        metadata: { id: 'alice' },
      });
      editor.dispatchCommand(INSERT_MENTION_COMMAND, {
        label: 'Bob',
        metadata: { id: 'bob' },
      });
    });
    await nextTick();

    expect(inserted).toEqual(['Alice', 'Bob']);
    expect(service.getMentions().map((mention) => mention.label)).toEqual(['Alice', 'Bob']);
  });

  it('keeps slash-style query cleanup ahead of the queued mention insertion', async () => {
    const editor = createEditor();
    const service = editor.requireService(IMentionService)!;
    const inserted: string[] = [];
    service.subscribe((mention: MentionDescriptor) => inserted.push(mention.label));
    editor.setDocument('text', '@Alice');

    const lexicalEditor = editor.getLexicalEditor()!;
    lexicalEditor.update(() => {
      const paragraph = $getRoot().getFirstChild();
      const queryNode = $isElementNode(paragraph) ? paragraph.getFirstChild() : null;
      if ($isTextNode(queryNode)) {
        queryNode.select(0, queryNode.getTextContentSize());
        // ReactSlashPlugin queues query cleanup before it calls the external
        // mention onSelect, which then dispatches INSERT_MENTION_COMMAND.
        lexicalEditor.update(() => {
          const selection = $getSelection();
          if ($isRangeSelection(selection)) selection.removeText();
        });
      }

      editor.dispatchCommand(INSERT_MENTION_COMMAND, {
        label: 'Alice',
        metadata: { id: 'alice' },
      });
    });
    await nextTick();

    expect(editor.getDocument('text')).toBe('Alice');
    expect(inserted).toEqual(['Alice']);
    expect(service.getMentions()).toEqual([{ label: 'Alice', metadata: { id: 'alice' } }]);
  });

  it('does not emit for import, deletion, undo, or an insert removed in the same update', async () => {
    const editor = createEditor();
    const service = editor.requireService(IMentionService)!;
    const inserted: string[] = [];
    service.subscribe((mention: MentionDescriptor) => inserted.push(mention.label));

    editor.setDocument('json', {
      root: {
        children: [
          {
            children: [
              { label: 'Imported', metadata: { id: 'imported' }, type: 'mention', version: 1 },
            ],
            type: 'paragraph',
            version: 1,
          },
        ],
        type: 'root',
        version: 1,
      },
    });
    expect(inserted).toEqual([]);

    editor.getLexicalEditor()!.update(() => {
      const paragraph = $getRoot().getFirstChild();
      if ($isElementNode(paragraph)) paragraph.getFirstChild()?.remove();
    });
    await nextTick();
    expect(inserted).toEqual([]);
    expect(service.getMentions()).toEqual([]);

    editor.getLexicalEditor()!.update(() => {
      $getRoot().selectEnd();
      editor.dispatchCommand(INSERT_MENTION_COMMAND, {
        label: 'Transient',
        metadata: { id: 'transient' },
      });
      editor.getLexicalEditor()!.update(() => {
        const paragraph = $getRoot().getLastChild();
        if ($isElementNode(paragraph)) paragraph.getFirstChild()?.remove();
      });
    });
    await nextTick();
    expect(inserted).toEqual([]);

    editor.dispatchCommand(INSERT_MENTION_COMMAND, {
      label: 'Created',
      metadata: { id: 'created' },
    });
    await nextTick();
    expect(inserted).toEqual(['Created']);

    editor.dispatchCommand(UNDO_COMMAND, undefined);
    await nextTick();
    expect(inserted).toEqual(['Created']);
    expect(service.getMentions()).toEqual([]);
  });

  it('isolates service instances and stops callbacks after unsubscribe and destroy', async () => {
    const first = createEditor();
    const second = createEditor();
    const firstService = first.requireService(IMentionService)!;
    const secondService = second.requireService(IMentionService)!;
    const firstListener = vi.fn();
    const secondInserted: string[] = [];
    const unsubscribeFirst = firstService.subscribe(firstListener);
    secondService.subscribe((mention: MentionDescriptor) => secondInserted.push(mention.label));

    first.dispatchCommand(INSERT_MENTION_COMMAND, { label: 'Alice', metadata: { id: 'alice' } });
    await nextTick();
    expect(firstListener).toHaveBeenCalledTimes(1);
    expect(secondInserted).toEqual([]);

    unsubscribeFirst();
    first.dispatchCommand(INSERT_MENTION_COMMAND, { label: 'Bob', metadata: { id: 'bob' } });
    await nextTick();
    expect(firstListener).toHaveBeenCalledTimes(1);
    expect(secondInserted).toEqual([]);

    second.dispatchCommand(INSERT_MENTION_COMMAND, { label: 'Carol', metadata: { id: 'carol' } });
    await nextTick();
    expect(secondInserted).toEqual(['Carol']);
    second.destroy();
    expect(secondService.getMentions()).toEqual([]);
  });

  it('does not emit a pending callback after disposal and recovers after an aborted update', async () => {
    const editor = createEditor();
    const service = editor.requireService(IMentionService)!;
    const inserted: string[] = [];
    service.subscribe((mention) => inserted.push(mention.label));

    editor.getLexicalEditor()!.update(() => {
      $getRoot().selectEnd();
      editor.dispatchCommand(INSERT_MENTION_COMMAND, {
        label: 'Disposed',
        metadata: { id: 'disposed' },
      });
      (service as unknown as MentionServiceForTest).dispose();
    });
    await nextTick();
    expect(inserted).toEqual([]);

    const recovered = createEditor();
    const recoveredService = recovered.requireService(IMentionService)!;
    recoveredService.subscribe((mention: MentionDescriptor) => inserted.push(mention.label));
    const internalRecoveredService = recoveredService as unknown as {
      onMentionInserted(node: MentionNode): void;
    };
    expect(() => {
      recovered.getLexicalEditor()!.update(() => {
        const node = $createMentionNode('Aborted', { id: 'aborted' });
        $insertNodes([node]);
        internalRecoveredService.onMentionInserted(node);
        throw new Error('abort update');
      });
    }).not.toThrow();
    await nextTick();

    recovered.dispatchCommand(INSERT_MENTION_COMMAND, {
      label: 'Recovered',
      metadata: { id: 'recovered' },
    });
    await nextTick();
    expect(inserted).toEqual(['Recovered']);
  });
});

type MentionServiceForTest = {
  dispose(): void;
};

function findSerializedMentions(
  document: any,
): Array<{ label: string; metadata: Record<string, unknown> }> {
  const mentions: Array<{ label: string; metadata: Record<string, unknown> }> = [];
  const visit = (node: any) => {
    if (node?.type === 'mention') {
      mentions.push({ label: node.label, metadata: node.metadata });
    }
    node?.children?.forEach(visit);
  };
  visit(document?.root);
  return mentions;
}
