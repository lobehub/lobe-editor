// @vitest-environment node
import {
  $createParagraphNode,
  $createTextNode,
  $getRoot,
  createEditor,
  ParagraphNode,
} from 'lexical';
import { $createMentionNode, MentionNode } from '@/plugins/mention/node/MentionNode';
import { LoroDoc } from 'loro-crdt';
import { describe, expect, it } from 'vitest';

import {
  createLoroCollaborationService,
  LoroCanonicalDocument,
  LoroLexicalBinding,
} from '../index';

describe('Loro collaboration service anchors', () => {
  it('resolves a cursor against its owning flow instead of the first text node', async () => {
    const editor = createEditor({
      namespace: 'loro-anchor-test',
      nodes: [ParagraphNode],
      onError: () => undefined,
    });
    editor.update(() => {
      $getRoot().append(
        $createParagraphNode().append($createTextNode('earlier paragraph')),
        $createParagraphNode().append($createTextNode('target')),
      );
    });
    const binding = new LoroLexicalBinding({
      doc: new LoroCanonicalDocument(new LoroDoc()),
      editor,
    });
    await new Promise((resolve) => setTimeout(resolve, 0));
    const targetId = binding.canonical
      .getNodes()
      .map((node) => binding.canonical.readNode(node))
      .find((node) => node.flow?.toString() === 'target')!.nodeId!;
    const service = createLoroCollaborationService(binding);
    const anchor = service.capturePoint({ nodeId: targetId, offset: 3 });
    expect(anchor).not.toBeNull();
    expect(service.resolveAnchorOffset(anchor!, targetId)).toBe(3);
    const points = service.resolvePoints(anchor!, anchor!);
    const targetKey = editor
      .getEditorState()
      .read(() => ($getRoot().getChildren()[1] as ParagraphNode).getFirstChild()!.getKey());
    expect(points?.anchor.key).toBe(targetKey);
    expect(points?.focus.key).toBe(targetKey);
    service.dispose();
  });

  it('maps logical offsets around an inline atom to its one-code-unit sentinel', async () => {
    const editor = createEditor({
      namespace: 'loro-inline-anchor-test',
      nodes: [ParagraphNode, MentionNode],
      onError: (error) => {
        throw error;
      },
    });
    editor.update(() => {
      $getRoot().append(
        $createParagraphNode().append(
          $createTextNode('a'),
          $createMentionNode('Ada', { id: '42' }),
          $createTextNode('b'),
        ),
      );
    });
    const binding = new LoroLexicalBinding({
      doc: new LoroCanonicalDocument(new LoroDoc()),
      editor,
    });
    await new Promise((resolve) => setTimeout(resolve, 0));
    const paragraphId = binding.canonical
      .getNodes()
      .map((node) => binding.canonical.readNode(node))
      .find((node) => node.type === 'paragraph')!.nodeId!;
    const service = createLoroCollaborationService(binding);
    const anchor = service.capturePoint({ nodeId: paragraphId, offset: 4 });
    expect(anchor).not.toBeNull();
    expect(service.resolveAnchorOffset(anchor!, paragraphId)).toBe(4);
    service.dispose();
  });
});
