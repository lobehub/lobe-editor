// @vitest-environment node

import { type Provider, type ProviderAwareness, type UserState, createBinding } from '@lexical/yjs';
import {
  $createRangeSelection,
  $getRoot,
  $isElementNode,
  $isTextNode,
  $setSelection,
} from 'lexical';
import { afterEach, describe, expect, it } from 'vitest';
import { Doc } from 'yjs';

import { HeadlessEditor } from '@/headless';
import { $ensureNodeIdsInTree, $getNodeId } from '@/plugins/properties';
import { IYjsService, YjsService } from '@/plugins/yjs/service';
import { syncCurrentEditorStateToYjs } from '@/plugins/yjs/plugin/utils/sync';

import { captureCollaborativeRewriteSelection } from '../selection';

class NoopAwareness implements ProviderAwareness {
  private localState: UserState | null = null;

  getLocalState(): UserState | null {
    return this.localState;
  }

  getStates(): Map<number, UserState> {
    return this.localState ? new Map([[1, this.localState]]) : new Map();
  }

  off(): void {}

  on(): void {}

  setLocalState(state: UserState | null): void {
    this.localState = state;
  }

  setLocalStateField(field: string, value: unknown): void {
    this.localState = {
      ...(this.localState ?? {
        anchorPos: null,
        awarenessData: {},
        color: '#7c3aed',
        focusPos: null,
        focusing: true,
        name: 'User',
      }),
      [field]: value,
    };
  }
}

const createProvider = (): Provider =>
  ({
    awareness: new NoopAwareness(),
    connect: () => undefined,
    disconnect: () => undefined,
    off: () => undefined,
    on: () => undefined,
  }) as Provider;

const getParagraphTexts = (headless: HeadlessEditor) => {
  const lexicalEditor = headless.kernel.getLexicalEditor();
  if (!lexicalEditor) throw new Error('Missing lexical editor.');

  return lexicalEditor.getEditorState().read(() =>
    $getRoot()
      .getChildren()
      .flatMap((block) => {
        const textNode = $isElementNode(block) ? block.getFirstDescendant() : null;
        return textNode && $isTextNode(textNode) ? [textNode] : [];
      }),
  );
};

const selectTextRange = (
  headless: HeadlessEditor,
  anchorKey: string,
  anchorOffset: number,
  focusKey: string,
  focusOffset: number,
): void => {
  const lexicalEditor = headless.kernel.getLexicalEditor();
  if (!lexicalEditor) throw new Error('Missing lexical editor.');

  lexicalEditor.update(
    () => {
      const range = $createRangeSelection();
      range.anchor.set(anchorKey, anchorOffset, 'text');
      range.focus.set(focusKey, focusOffset, 'text');
      $setSelection(range);
    },
    { discrete: true },
  );
};

describe('captureCollaborativeRewriteSelection', () => {
  const editors: HeadlessEditor[] = [];

  afterEach(() => {
    while (editors.length > 0) editors.pop()?.destroy();
  });

  it('captures forward and reverse cross-block ranges with durable ids and v1 relative positions', () => {
    const headless = new HeadlessEditor();
    editors.push(headless);
    headless.hydrateMarkdown('First paragraph\n\nSecond paragraph');

    const lexicalEditor = headless.kernel.getLexicalEditor();
    if (!lexicalEditor) throw new Error('Missing lexical editor.');
    lexicalEditor.update(
      () => {
        $ensureNodeIdsInTree();
      },
      { discrete: true },
    );

    const provider = createProvider();
    const doc = new Doc();
    const docMap = new Map([['page-1', doc]]);
    const binding = createBinding(lexicalEditor, provider, 'page-1', doc, docMap);
    syncCurrentEditorStateToYjs(binding, provider);
    const yjsService = new YjsService();
    yjsService.setState({ binding, doc, docMap, id: 'page-1', provider });
    (
      headless.kernel as unknown as {
        registerServiceHotReload: (serviceId: typeof IYjsService, service: YjsService) => void;
      }
    ).registerServiceHotReload(IYjsService, yjsService);

    const [firstText, secondText] = getParagraphTexts(headless);
    if (!firstText || !secondText) throw new Error('Missing paragraph text nodes.');
    const nodeIds = lexicalEditor
      .getEditorState()
      .read(() => [
        $getNodeId(firstText.getParentOrThrow()),
        $getNodeId(secondText.getParentOrThrow()),
      ]);
    if (!nodeIds[0] || !nodeIds[1]) throw new Error('Missing durable paragraph ids.');

    selectTextRange(headless, firstText.getKey(), 2, secondText.getKey(), 6);
    const forward = captureCollaborativeRewriteSelection(headless.kernel, {
      capturedAt: '2026-08-29T00:00:00.000Z',
    });

    expect(forward).toMatchObject({
      baseStateVector: expect.stringMatching(/^[A-Za-z0-9+/]+=*$/),
      capturedAt: '2026-08-29T00:00:00.000Z',
      endNodeId: nodeIds[1],
      kind: 'relative',
      roomId: 'page-1',
      startNodeId: nodeIds[0],
      targetNodeIds: nodeIds,
    });
    if (!forward || forward.kind !== 'relative') throw new Error('Missing relative selection.');
    expect(forward.quotedText).toBe('rst paragraph Second');
    expect(forward.quotedTextHash).toMatch(/^fnv1a-/);
    expect(forward).toHaveProperty('anchorPos');
    expect(forward).toHaveProperty('focusPos');
    expect(forward).not.toHaveProperty('anchorKey');
    expect(forward).not.toHaveProperty('focusKey');
    expect(forward).not.toHaveProperty('doc');

    selectTextRange(headless, secondText.getKey(), 6, firstText.getKey(), 2);
    const reverse = captureCollaborativeRewriteSelection(headless.kernel);
    expect(reverse).toMatchObject({
      endNodeId: nodeIds[1],
      kind: 'relative',
      startNodeId: nodeIds[0],
      targetNodeIds: nodeIds,
    });
    if (!reverse || reverse.kind !== 'relative') throw new Error('Missing reverse selection.');
    expect(reverse.quotedText).toBe(forward.quotedText);
    expect(reverse.anchorPos).not.toEqual(forward.anchorPos);
    expect(reverse.focusPos).not.toEqual(forward.focusPos);
  });

  it('returns a durable block fallback when no Yjs binding is attached', () => {
    const headless = new HeadlessEditor();
    editors.push(headless);
    headless.hydrateMarkdown('A paragraph without collaboration');

    const lexicalEditor = headless.kernel.getLexicalEditor();
    if (!lexicalEditor) throw new Error('Missing lexical editor.');
    lexicalEditor.update(
      () => {
        $ensureNodeIdsInTree();
      },
      { discrete: true },
    );

    const [text] = getParagraphTexts(headless);
    if (!text) throw new Error('Missing paragraph text node.');
    selectTextRange(headless, text.getKey(), 2, text.getKey(), 11);

    const captured = captureCollaborativeRewriteSelection(headless.kernel);
    expect(captured).toMatchObject({
      endOffset: 11,
      kind: 'block',
      quotedText: 'paragraph',
      startOffset: 2,
      targetNodeIds: [expect.any(String)],
    });
    expect(captured).not.toHaveProperty('anchorPos');
    expect(captured).not.toHaveProperty('roomId');
    expect(captured?.quotedTextHash).toMatch(/^fnv1a-/);
  });

  it('uses root preorder when the selection candidate list is reversed', () => {
    const headless = new HeadlessEditor();
    editors.push(headless);
    headless.hydrateMarkdown('First paragraph\n\nSecond paragraph');

    const lexicalEditor = headless.kernel.getLexicalEditor();
    if (!lexicalEditor) throw new Error('Missing lexical editor.');
    lexicalEditor.update(
      () => {
        $ensureNodeIdsInTree();
      },
      { discrete: true },
    );

    const provider = createProvider();
    const doc = new Doc();
    const docMap = new Map([['page-order', doc]]);
    const binding = createBinding(lexicalEditor, provider, 'page-order', doc, docMap);
    syncCurrentEditorStateToYjs(binding, provider);
    const yjsService = new YjsService();
    yjsService.setState({ binding, doc, docMap, id: 'page-order', provider });
    (
      headless.kernel as unknown as {
        registerServiceHotReload: (serviceId: typeof IYjsService, service: YjsService) => void;
      }
    ).registerServiceHotReload(IYjsService, yjsService);

    const [firstText, secondText] = getParagraphTexts(headless);
    if (!firstText || !secondText) throw new Error('Missing paragraph text nodes.');
    const nodeIds = lexicalEditor
      .getEditorState()
      .read(() => [
        $getNodeId(firstText.getParentOrThrow()),
        $getNodeId(secondText.getParentOrThrow()),
      ]);
    if (!nodeIds[0] || !nodeIds[1]) throw new Error('Missing durable paragraph ids.');

    lexicalEditor.update(
      () => {
        const range = $createRangeSelection();
        range.anchor.set(firstText.getKey(), 0, 'text');
        range.focus.set(secondText.getKey(), secondText.getTextContentSize(), 'text');
        // Reproduce the real Cmd/Ctrl+A candidate traversal that surfaced the
        // bug: selected blocks arrive in reverse order, while the root object
        // remains the authoritative document identity.
        Object.defineProperty(range, 'getNodes', {
          configurable: true,
          value: () => [secondText, firstText],
        });
        $setSelection(range);
      },
      { discrete: true },
    );

    const captured = captureCollaborativeRewriteSelection(headless.kernel, {
      capturedAt: '2026-08-30T00:00:00.000Z',
    });
    expect(captured).toMatchObject({
      endNodeId: nodeIds[1],
      kind: 'relative',
      startNodeId: nodeIds[0],
      targetNodeIds: nodeIds,
    });
    expect(JSON.parse(JSON.stringify(captured)).targetNodeIds).toEqual(nodeIds);

    binding.root.destroy(binding);
    doc.destroy();
  });
});
