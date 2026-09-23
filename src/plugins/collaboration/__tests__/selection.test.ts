import {
  $createParagraphNode,
  $createTextNode,
  $getRoot,
  $setSelection,
  $createRangeSelection,
  createEditor,
  ParagraphNode,
} from 'lexical';
import { describe, expect, it, vi } from 'vitest';

import { $setNodeProperties } from '@/plugins/properties';
import { captureAnchorRewriteSelection } from '../selection';

const descriptor = { bindingSchema: 'lexical-loro-v1', engine: 'loro', epoch: 0 } as const;

describe('captureAnchorRewriteSelection', () => {
  it('captures UTF-16 offsets across formatted text through the neutral service', () => {
    const lexicalEditor = createEditor({
      namespace: 'neutral-selection-test',
      nodes: [ParagraphNode],
      onError: (error) => {
        throw error;
      },
    });
    let firstId = '';
    let secondId = '';
    lexicalEditor.update(
      () => {
        const first = $createParagraphNode();
        const firstText = $createTextNode('A😀B');
        firstText.toggleFormat('bold');
        $setNodeProperties(first, { nodeId: 'paragraph-a' });
        first.append(firstText);
        const second = $createParagraphNode();
        const secondText = $createTextNode('尾');
        $setNodeProperties(second, { nodeId: 'paragraph-b' });
        second.append(secondText);
        $getRoot().append(first, second);
        firstId = firstText.getKey();
        secondId = secondText.getKey();
      },
      { discrete: true },
    );

    lexicalEditor.update(
      () => {
        const selection = $createRangeSelection();
        selection.anchor.set(firstId, 1, 'text');
        selection.focus.set(secondId, 1, 'text');
        $setSelection(selection);
      },
      { discrete: true },
    );

    const capturePoint = vi.fn((point: { nodeId: string; offset: number }) => ({
      cursor: `${point.nodeId}:${point.offset}`,
      descriptor,
      kind: 'text-cursor' as const,
    }));
    const fakeEditor = {
      getLexicalEditor: () => lexicalEditor,
      requireService: () => ({
        capturePoint,
        descriptor,
        getVersionProof: () => ({
          causalVersion: { kind: 'crdt-causal-version' as const, value: 'vv' },
          descriptor,
        }),
      }),
    } as never;

    const captured = captureAnchorRewriteSelection(fakeEditor, {
      capturedAt: '2026-09-20T00:00:00.000Z',
      roomId: 'room-1',
    });

    expect(captured).toMatchObject({
      descriptor,
      kind: 'anchor',
      quotedText: '😀B 尾',
      roomId: 'room-1',
      startNodeId: 'paragraph-a',
      startOffset: 1,
      endNodeId: 'paragraph-b',
      endOffset: 1,
    });
    expect(captured?.quotedTextHash).toBeTruthy();
    expect(capturePoint).toHaveBeenNthCalledWith(1, { nodeId: 'paragraph-a', offset: 1 });
    expect(capturePoint).toHaveBeenNthCalledWith(2, { nodeId: 'paragraph-b', offset: 1 });
  });
});
