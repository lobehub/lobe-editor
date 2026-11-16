import {
  $createParagraphNode,
  $createRangeSelection,
  $createTextNode,
  $getRoot,
  $getSelection,
  $isElementNode,
  $isTextNode,
  $setSelection,
  HISTORY_PUSH_TAG,
  REDO_COMMAND,
  UNDO_COMMAND,
  type LexicalNode,
} from 'lexical';
import { afterEach, describe, expect, it, vi } from 'vitest';

import Editor, { moment } from '@/editor-kernel';
import { CommonPlugin, INodeIdentityService, $getNodeById } from '@/plugins/common';
import { $getNodeId, $normalizeNodeIds, $setNodeId } from '@/plugins/common/node/node-id';
import { registerNodeIdentityPolicy } from '@/plugins/common/node/node-identity-policy';
import { NodeIdentityService } from '@/plugins/common/service/node-identity-service';
import {
  DiffAction,
  LITEXML_APPLY_COMMAND,
  LITEXML_DIFFNODE_ALL_COMMAND,
  LITEXML_REMOVE_COMMAND,
  LitexmlPlugin,
} from '@/plugins/litexml';
import { hasActiveLiteXmlNodeId } from '@/plugins/litexml/diff-validation';
import { $createDiffContentNode } from '@/plugins/litexml/node/DiffContentNode';
import { $createDiffNode } from '@/plugins/litexml/node/DiffNode';
import type { IEditor, IEditorPluginConstructor } from '@/types';

type Paragraph = { id: string; text: string; textId: string };
type NodeSummary = { id: string | undefined; key: string; textContent: string; type: string };

const editors: IEditor[] = [];

function createEditor(plugins: IEditorPluginConstructor<any>[] = [CommonPlugin]): IEditor {
  const editor = Editor.createEditor();
  editor.registerPlugins(plugins);
  editor.initNodeEditor();
  editors.push(editor);
  return editor;
}

function loadParagraphs(editor: IEditor, paragraphs: Paragraph[]): void {
  const document = {
    root: {
      children: paragraphs.map(({ id, text, textId }) => ({
        children: [
          {
            detail: 0,
            format: 0,
            id: textId,
            mode: 'normal',
            style: '',
            text,
            type: 'text',
            version: 1,
          },
        ],
        direction: 'ltr',
        format: '',
        id,
        indent: 0,
        type: 'paragraph',
        version: 1,
      })),
      direction: 'ltr',
      format: '',
      indent: 0,
      type: 'root',
      version: 1,
    },
  };
  editor.setDocument('json', document as Parameters<IEditor['setDocument']>[1], { keepId: true });
}

function findLexicalNode(
  node: LexicalNode,
  predicate: (candidate: LexicalNode) => boolean,
): LexicalNode | null {
  if (predicate(node)) return node;
  if (!$isElementNode(node)) return null;
  for (const child of node.getChildren()) {
    const found = findLexicalNode(child, predicate);
    if (found) return found;
  }
  return null;
}

function summarize(node: LexicalNode | null): NodeSummary | null {
  return node
    ? {
        id: $getNodeId(node),
        key: node.getKey(),
        textContent: node.getTextContent(),
        type: node.getType(),
      }
    : null;
}

function lookup(editor: IEditor, id: string): NodeSummary | null {
  return editor
    .getLexicalEditor()!
    .getEditorState()
    .read(() => summarize($getNodeById(id)), {
      editor: editor.getLexicalEditor()!,
    });
}

describe('public node identity contract', () => {
  afterEach(() => {
    editors.splice(0).forEach((editor) => editor.destroy());
  });

  it('finds durable IDs in a CommonPlugin-only editor', () => {
    const editor = createEditor();
    loadParagraphs(editor, [{ id: 'paragraph-one', text: 'Alpha', textId: 'text-one' }]);

    expect(lookup(editor, 'text-one')).toMatchObject({
      id: 'text-one',
      textContent: 'Alpha',
      type: 'text',
    });
    expect(lookup(editor, 'paragraph-one')).toMatchObject({
      id: 'paragraph-one',
      textContent: 'Alpha',
      type: 'paragraph',
    });
    expect(lookup(editor, 'absent')).toBeNull();
  });

  it('requires an editor-bound Lexical context for policy-aware lookup', () => {
    const editor = createEditor();
    loadParagraphs(editor, [{ id: 'paragraph-one', text: 'Alpha', textId: 'text-one' }]);
    const lexicalEditor = editor.getLexicalEditor()!;

    expect(lexicalEditor.read(() => summarize($getNodeById('text-one')))).toMatchObject({
      id: 'text-one',
      textContent: 'Alpha',
    });
    expect(() => lexicalEditor.getEditorState().read(() => $getNodeById('text-one'))).toThrow(
      /editor/i,
    );
  });

  it('returns null for invalid JavaScript IDs and never matches an ID-less node', () => {
    const editor = createEditor();
    loadParagraphs(editor, [{ id: 'paragraph-one', text: 'Alpha', textId: 'text-one' }]);
    const lexicalEditor = editor.getLexicalEditor()!;
    const service = editor.requireService(INodeIdentityService);
    if (!service) throw new Error('Expected CommonPlugin identity service.');
    const invalidIds = [undefined, null, '', '   '] as unknown as string[];

    lexicalEditor.update(() => {
      const withoutId = $createParagraphNode();
      $getRoot().append(withoutId);
      expect($getNodeId(withoutId)).toBeUndefined();
      for (const id of invalidIds) expect($getNodeById(id)).toBeNull();
    });
    for (const id of invalidIds) expect(service.getNodeById(id)).toBeNull();
    expect(lookup(editor, 'text-one ')).toBeNull();
  });

  it('offers detached committed snapshots and post-commit notifications without LiteXML', async () => {
    const editor = createEditor();
    loadParagraphs(editor, [{ id: 'paragraph-one', text: 'Before', textId: 'text-one' }]);
    const service = editor.requireService(INodeIdentityService);
    if (!service) throw new Error('Expected CommonPlugin identity service.');

    const original = service.getNodeById('text-one');
    expect(original).toEqual({ id: 'text-one', textContent: 'Before', type: 'text' });
    expect(service.getNodeById('absent')).toBeNull();
    const notifications: Array<ReturnType<typeof service.getNodeById>> = [];
    const unsubscribe = service.subscribe(() => {
      notifications.push(service.getNodeById('text-two'));
    });

    editor.getLexicalEditor()!.update(() => {
      const text = $getNodeById('text-one');
      if (!$isTextNode(text)) throw new Error('Expected original text node.');
      $setNodeId(text, 'text-two');
      text.setTextContent('After');
    });
    await moment();

    expect(service.getNodeById('text-one')).toBeNull();
    expect(service.getNodeById('text-two')).toEqual({
      id: 'text-two',
      textContent: 'After',
      type: 'text',
    });
    expect(notifications.at(-1)).toEqual(service.getNodeById('text-two'));
    expect(original).toEqual({ id: 'text-one', textContent: 'Before', type: 'text' });
    Reflect.set(original!, 'textContent', 'Mutated outside Lexical');
    expect(service.getNodeById('text-one')).toBeNull();
    expect(service.getNodeById('text-two')?.textContent).toBe('After');

    unsubscribe();
    const delivered = notifications.length;
    editor.getLexicalEditor()!.update(() => {
      const text = $getNodeById('text-two');
      if (!$isTextNode(text)) throw new Error('Expected renamed text node.');
      text.setTextContent('Later');
    });
    await moment();
    expect(notifications).toHaveLength(delivered);
  });

  it('keeps the service available across plugin order and replaces it after disposal', () => {
    for (const plugins of [
      [CommonPlugin, LitexmlPlugin],
      [LitexmlPlugin, CommonPlugin],
    ]) {
      const editor = createEditor(plugins);
      editor.setDocument('litexml', '<root><p id="paragraph-one">Alpha</p></root>');
      const oldService = editor.requireService(INodeIdentityService);
      if (!oldService) throw new Error('Expected CommonPlugin identity service.');
      expect(oldService.getNodeById('paragraph-one')).toMatchObject({
        id: 'paragraph-one',
        textContent: 'Alpha',
        type: 'paragraph',
      });

      editor.destroy();
      expect(editor.requireService(INodeIdentityService)).toBeNull();
      expect(oldService.getNodeById('paragraph-one')).toBeNull();

      editor.initNodeEditor();
      editor.setDocument('litexml', '<root><p id="paragraph-one">Reinitialized</p></root>');
      const newService = editor.requireService(INodeIdentityService);
      expect(newService).toBeTruthy();
      expect(newService).not.toBe(oldService);
      expect(newService?.getNodeById('paragraph-one')?.textContent).toBe('Reinitialized');
    }
  });

  it('bounds a lookup to the supplied subtree', () => {
    const editor = createEditor();
    loadParagraphs(editor, [
      { id: 'paragraph-one', text: 'Alpha', textId: 'text-one' },
      { id: 'paragraph-two', text: 'Beta', textId: 'text-two' },
    ]);

    editor
      .getLexicalEditor()!
      .getEditorState()
      .read(
        () => {
          const first = $getRoot().getFirstChild();
          if (!first) throw new Error('Expected first paragraph.');
          expect($getNodeById('paragraph-one', first)).toBe(first);
          expect(summarize($getNodeById('text-one', first))?.textContent).toBe('Alpha');
          expect($getNodeById('text-two', first)).toBeNull();
          expect(summarize($getNodeById('text-two'))?.textContent).toBe('Beta');
          expect($getNodeById('text-two', first)).toBeNull();
        },
        { editor: editor.getLexicalEditor()! },
      );
  });

  it('updates warmed hits and misses when a document policy is registered or disposed', () => {
    const editor = createEditor();
    loadParagraphs(editor, [{ id: 'paragraph-one', text: 'Alpha', textId: 'text-one' }]);
    const lexicalEditor = editor.getLexicalEditor()!;
    const service = editor.requireService(INodeIdentityService);
    if (!service) throw new Error('Expected CommonPlugin identity service.');
    expect(lookup(editor, 'text-one')?.textContent).toBe('Alpha');
    expect(service.getNodeById('text-one')?.textContent).toBe('Alpha');
    const notifications: Array<ReturnType<typeof service.getNodeById>> = [];
    const unsubscribeService = service.subscribe(() => {
      notifications.push(service.getNodeById('text-one'));
    });

    const unregister = registerNodeIdentityPolicy(lexicalEditor, {
      canShareId: () => false,
      isIdentityNode: (node) => node.getType() !== 'root',
      project: (node) =>
        node.getType() === 'root' ? 'container' : node.getType() === 'text' ? 'hidden' : 'content',
    });
    expect(lookup(editor, 'text-one')).toBeNull();
    expect(service.getNodeById('text-one')).toBeNull();
    expect(notifications).toEqual([null]);
    expect(lookup(editor, 'paragraph-one')?.textContent).toBe('Alpha');

    unregister();
    expect(lookup(editor, 'text-one')?.textContent).toBe('Alpha');
    expect(service.getNodeById('text-one')?.textContent).toBe('Alpha');
    expect(notifications.at(-1)?.textContent).toBe('Alpha');
    unsubscribeService();
  });

  it('keeps a newer same-editor service binding after stale cleanup and cleans up once', () => {
    const editor = createEditor();
    loadParagraphs(editor, [{ id: 'paragraph-one', text: 'Alpha', textId: 'text-one' }]);
    const lexicalEditor = editor.getLexicalEditor()!;
    const service = new NodeIdentityService();
    const oldCleanup = service.bindEditor(lexicalEditor);
    const currentCleanup = service.bindEditor(lexicalEditor);
    const notifications: string[] = [];
    service.subscribe(() => notifications.push('policy changed'));

    oldCleanup();
    const unregister = registerNodeIdentityPolicy(lexicalEditor, {
      canShareId: () => false,
      isIdentityNode: (node) => node.getType() !== 'root',
      project: (node) =>
        node.getType() === 'root' ? 'container' : node.getType() === 'text' ? 'hidden' : 'content',
    });
    expect(notifications).toEqual(['policy changed']);
    expect(service.getNodeById('text-one')).toBeNull();

    currentCleanup();
    currentCleanup();
    unregister();
    expect(notifications).toEqual(['policy changed']);
    expect(service.getNodeById('text-one')).toBeNull();
  });

  it('does not reuse a warmed index after rebinding to another editor sharing the same state', async () => {
    const first = createEditor();
    const second = createEditor();
    loadParagraphs(first, [{ id: 'paragraph-one', text: 'Alpha', textId: 'text-one' }]);
    const firstLexical = first.getLexicalEditor()!;
    const secondLexical = second.getLexicalEditor()!;
    const sharedState = firstLexical.getEditorState();
    secondLexical.setEditorState(sharedState);
    await moment();
    // Lexical clones a state when it is installed on another editor. Model the
    // shared immutable snapshot explicitly to exercise the service cache key.
    const getSecondState = vi.spyOn(secondLexical, 'getEditorState').mockReturnValue(sharedState);

    const unregisterFirstPolicy = registerNodeIdentityPolicy(firstLexical, {
      canShareId: () => false,
      isIdentityNode: (node) => node.getType() !== 'root',
      project: (node) =>
        node.getType() === 'root' ? 'container' : node.getType() === 'text' ? 'hidden' : 'content',
    });
    const unregisterSecondPolicy = registerNodeIdentityPolicy(secondLexical, {
      canShareId: () => false,
      isIdentityNode: (node) => node.getType() !== 'root',
      project: (node) => (node.getType() === 'root' ? 'container' : 'content'),
    });
    const service = new NodeIdentityService();
    const firstCleanup = service.bindEditor(firstLexical);
    expect(service.getNodeById('text-one')).toBeNull();

    const secondCleanup = service.bindEditor(secondLexical);
    firstCleanup();
    expect(service.getNodeById('text-one')?.textContent).toBe('Alpha');

    secondCleanup();
    unregisterFirstPolicy();
    unregisterSecondPolicy();
    getSecondState.mockRestore();
  });

  it('delivers each notification to a bounded subscriber snapshot', () => {
    const editor = createEditor();
    const lexicalEditor = editor.getLexicalEditor()!;
    const service = editor.requireService(INodeIdentityService);
    if (!service) throw new Error('Expected CommonPlugin identity service.');
    const calls: string[] = [];
    const late = () => calls.push('late');
    let unsubscribe = () => {};
    let resubscribed = false;
    const first = () => {
      calls.push('first');
      unsubscribe();
      if (!resubscribed) {
        resubscribed = true;
        unsubscribe = service.subscribe(first);
        service.subscribe(late);
      }
    };
    unsubscribe = service.subscribe(first);

    const unregister = registerNodeIdentityPolicy(lexicalEditor, {
      canShareId: () => false,
      isIdentityNode: (node) => node.getType() !== 'root',
      project: (node) => (node.getType() === 'root' ? 'container' : 'content'),
    });
    expect(calls).toEqual(['first']);
    unregister();
    expect(calls).toEqual(['first', 'first', 'late']);
  });

  it('continues notifying subscribers and committing after one subscriber throws', async () => {
    const editor = createEditor();
    loadParagraphs(editor, [{ id: 'paragraph-one', text: 'Before', textId: 'text-one' }]);
    const service = editor.requireService(INodeIdentityService);
    if (!service) throw new Error('Expected CommonPlugin identity service.');
    let delivered: ReturnType<typeof service.getNodeById> = null;
    service.subscribe(() => {
      throw new Error('subscriber failure');
    });
    service.subscribe(() => {
      delivered = service.getNodeById('text-one');
    });

    editor.getLexicalEditor()!.update(() => {
      const text = $getNodeById('text-one');
      if (!$isTextNode(text)) throw new Error('Expected text node.');
      text.setTextContent('After');
    });
    await moment();

    expect(delivered).toEqual({ id: 'text-one', textContent: 'After', type: 'text' });
    expect(service.getNodeById('text-one')?.textContent).toBe('After');
  });

  it('does not retain a hit or a miss after ID change, replacement, or deletion in one update', async () => {
    const editor = createEditor();
    const errors: Error[] = [];
    editor.on('error', (error) => errors.push(error));
    loadParagraphs(editor, [{ id: 'paragraph-one', text: 'Alpha', textId: 'text-one' }]);
    expect(lookup(editor, 'text-one')?.textContent).toBe('Alpha');
    expect(lookup(editor, 'text-renamed')).toBeNull();

    editor.getLexicalEditor()!.update(() => {
      const original = $getNodeById('text-one');
      if (!$isTextNode(original)) throw new Error('Expected original text node.');
      const paragraph = original.getParentOrThrow();

      $setNodeId(original, 'text-renamed');
      expect($getNodeById('text-one')).toBeNull();
      expect($getNodeById('text-renamed')?.getKey()).toBe(original.getKey());

      const replacement = $createTextNode('Replacement');
      $setNodeId(replacement, 'text-renamed');
      original.replace(replacement);
      expect($getNodeById('text-renamed')?.getKey()).toBe(replacement.getKey());
      expect($getNodeById('text-renamed')?.getTextContent()).toBe('Replacement');

      replacement.remove();
      expect($getNodeById('text-renamed')).toBeNull();

      const appended = $createTextNode('Final');
      $setNodeId(appended, 'text-renamed');
      if (!$isElementNode(paragraph)) throw new Error('Expected paragraph parent.');
      paragraph.append(appended);
      expect($getNodeById('text-renamed')?.getKey()).toBe(appended.getKey());
    });
    await moment();

    expect(errors).toEqual([]);
    expect(lookup(editor, 'text-one')).toBeNull();
    expect(lookup(editor, 'text-renamed')?.textContent).toBe('Final');
  });

  it('keeps a parsed candidate state separate from the live lookup', () => {
    const editor = createEditor();
    loadParagraphs(editor, [{ id: 'paragraph-one', text: 'Live', textId: 'text-one' }]);
    const lexicalEditor = editor.getLexicalEditor()!;
    const candidateJSON = structuredClone(lexicalEditor.getEditorState().toJSON());
    const candidateText = candidateJSON.root.children[0] as Record<string, any>;
    const candidateLeaf = candidateText.children[0] as Record<string, any>;
    candidateLeaf.$ = { ...candidateLeaf.$, properties: { nodeId: 'candidate-text' } };
    candidateLeaf.text = 'Candidate';
    const candidate = lexicalEditor.parseEditorState(candidateJSON);

    expect(
      candidate.read(() => summarize($getNodeById('candidate-text')), { editor: lexicalEditor }),
    ).toMatchObject({ id: 'candidate-text', textContent: 'Candidate' });
    expect(lookup(editor, 'candidate-text')).toBeNull();
    expect(lookup(editor, 'text-one')?.textContent).toBe('Live');
    expect(candidate.read(() => $getNodeById('text-one'), { editor: lexicalEditor })).toBeNull();
  });

  it('reads historical EditorState snapshots after the live ID has changed', async () => {
    const editor = createEditor();
    loadParagraphs(editor, [{ id: 'paragraph-one', text: 'Before', textId: 'text-one' }]);
    const lexicalEditor = editor.getLexicalEditor()!;
    const oldState = lexicalEditor.getEditorState();
    expect(lookup(editor, 'text-one')?.textContent).toBe('Before');

    lexicalEditor.update(() => {
      const text = $getNodeById('text-one');
      if (!$isTextNode(text)) throw new Error('Expected text node.');
      $setNodeId(text, 'text-two');
      text.setTextContent('After');
    });
    await moment();

    expect(lookup(editor, 'text-two')?.textContent).toBe('After');
    expect(lookup(editor, 'text-one')).toBeNull();
    expect(
      oldState.read(() => summarize($getNodeById('text-one')), { editor: lexicalEditor }),
    ).toMatchObject({
      id: 'text-one',
      textContent: 'Before',
    });
    expect(oldState.read(() => $getNodeById('text-two'), { editor: lexicalEditor })).toBeNull();
  });

  it('isolates identical public IDs in separate editors', () => {
    const first = createEditor();
    const second = createEditor();
    loadParagraphs(first, [{ id: 'shared-paragraph', text: 'First', textId: 'shared-text' }]);
    loadParagraphs(second, [{ id: 'shared-paragraph', text: 'Second', textId: 'shared-text' }]);

    expect(lookup(first, 'shared-text')?.textContent).toBe('First');
    expect(lookup(second, 'shared-text')?.textContent).toBe('Second');
    expect(lookup(first, 'shared-text')?.textContent).toBe('First');
  });

  it('keeps a legal review pair together when a third shared-ID node sorts first', async () => {
    const editor = createEditor([CommonPlugin, LitexmlPlugin]);
    editor.setDocument('litexml', '<root><p id="review-paragraph">Before</p></root>');
    editor.dispatchCommand(LITEXML_APPLY_COMMAND, {
      delay: true,
      litexml: '<p id="review-paragraph">After</p>',
    });
    await moment();

    const lexicalEditor = editor.getLexicalEditor()!;
    lexicalEditor.update(
      () => {
        const before = findLexicalNode(
          $getRoot(),
          (node) => node.getType() === 'paragraph' && node.getTextContent() === 'Before',
        );
        const after = findLexicalNode(
          $getRoot(),
          (node) => node.getType() === 'paragraph' && node.getTextContent() === 'After',
        );
        if (!before || !after) throw new Error('Expected both sides of the review diff.');

        // Recreate a persisted legacy review pair: current local reviews keep a
        // private ID on the hidden before side, so this fixture must explicitly
        // restore the legal shared-ID representation it is meant to exercise.
        $setNodeId(before, 'review-paragraph');

        const third = $createParagraphNode();
        third.append($createTextNode('Third collider'));
        $setNodeId(third, 'review-paragraph');
        $getRoot().append(third);

        const stableKeys = new Map([
          [third.getKey(), '00000000000000000000'],
          [before.getKey(), '00000000000000000001'],
          [after.getKey(), '00000000000000000002'],
        ]);
        $normalizeNodeIds($getRoot(), {
          stableDuplicateRepair: true,
          stableOwnershipKey: (node) => stableKeys.get(node.getKey()),
        });
      },
      { discrete: true },
    );

    const ids = lexicalEditor.getEditorState().read(
      () => {
        const before = findLexicalNode(
          $getRoot(),
          (node) => node.getType() === 'paragraph' && node.getTextContent() === 'Before',
        );
        const after = findLexicalNode(
          $getRoot(),
          (node) => node.getType() === 'paragraph' && node.getTextContent() === 'After',
        );
        return {
          after: after ? $getNodeId(after) : undefined,
          before: before ? $getNodeId(before) : undefined,
        };
      },
      { editor: lexicalEditor },
    );
    const third = (editor.getDocument('json') as any).root.children.find(
      (node: any) => node.type === 'paragraph' && node.children?.[0]?.text === 'Third collider',
    );
    const thirdId = third?.$.properties?.nodeId as string | undefined;

    expect(ids.before).toBe('review-paragraph');
    expect(ids.after).toBe('review-paragraph');
    expect(thirdId).toMatch(/^[0-9a-z]{10}$/);
    expect(thirdId).not.toBe('review-paragraph');
  });

  it('resolves the active side of a delayed modification and hides a removal', async () => {
    const editor = createEditor([CommonPlugin, LitexmlPlugin]);
    editor.setDocument(
      'litexml',
      '<root><p id="paragraph-one"><span id="text-one">Before</span></p></root>',
    );
    editor.dispatchCommand(LITEXML_APPLY_COMMAND, {
      delay: true,
      litexml: '<span id="text-one">After</span>',
    });
    await moment();

    const lexicalEditor = editor.getLexicalEditor()!;
    lexicalEditor.getEditorState().read(
      () => {
        const physical: LexicalNode[] = [];
        const walk = (node: LexicalNode) => {
          if ($getNodeId(node) === 'text-one') physical.push(node);
          if ($isElementNode(node)) node.getChildren().forEach(walk);
        };
        walk($getRoot());
        expect(physical).toHaveLength(2);
        expect($getNodeById('text-one')?.getTextContent()).toBe('After');
      },
      { editor: lexicalEditor },
    );
    const service = editor.requireService(INodeIdentityService);
    expect(service?.getNodeById('text-one')?.textContent).toBe('After');

    editor.dispatchCommand(LITEXML_REMOVE_COMMAND, { delay: true, id: 'paragraph-one' });
    await moment();
    expect(lookup(editor, 'paragraph-one')).toBeNull();
    expect(lookup(editor, 'text-one')).toBeNull();
    expect(service?.getNodeById('text-one')).toBeNull();
  });

  it('keeps a cross-block range anchored outside a delayed rewrite target', async () => {
    const editor = createEditor([LitexmlPlugin, CommonPlugin]);
    editor.setDocument(
      'litexml',
      '<root><p id="before"><span id="before-text">Leading text</span></p><p id="target">Original</p><p id="after"><span id="after-text">Trailing text</span></p></root>',
    );
    await moment();

    const lexicalEditor = editor.getLexicalEditor()!;
    let anchorKey = '';
    let focusKey = '';
    let anchorOffset = 0;
    let focusOffset = 0;
    lexicalEditor.update(() => {
      const anchorNode = $getNodeById('before-text');
      const focusNode = $getNodeById('after-text');
      if (!$isTextNode(anchorNode) || !$isTextNode(focusNode)) {
        throw new Error('Expected text nodes around the rewrite target.');
      }

      anchorKey = anchorNode.getKey();
      focusKey = focusNode.getKey();
      anchorOffset = 1;
      focusOffset = focusNode.getTextContentSize() - 1;
      const selection = $createRangeSelection();
      selection.anchor.set(anchorKey, anchorOffset, 'text');
      selection.focus.set(focusKey, focusOffset, 'text');
      $setSelection(selection);
    });
    await moment();

    editor.dispatchCommand(LITEXML_APPLY_COMMAND, {
      delay: true,
      litexml: '<p id="target">Rewritten</p>',
    });
    await moment();

    expect(lookup(editor, 'target')?.textContent).toBe('Rewritten');
    let actualEndpoints: [string, number, string, number] | null = null;
    lexicalEditor.getEditorState().read(
      () => {
        const endpoints = $getSelection()?.getStartEndPoints();
        if (endpoints) {
          actualEndpoints = [
            endpoints[0].key,
            endpoints[0].offset,
            endpoints[1].key,
            endpoints[1].offset,
          ];
        }
      },
      { editor: lexicalEditor },
    );
    expect(actualEndpoints).toEqual([anchorKey, anchorOffset, focusKey, focusOffset]);
  });

  it('does not address legacy IDs on root or review wrappers in live and serialized views', async () => {
    const editor = createEditor([CommonPlugin, LitexmlPlugin]);
    const lexicalEditor = editor.getLexicalEditor()!;
    lexicalEditor.update(() => {
      const root = $getRoot();
      $setNodeId(root, 'legacy-root');
      const diff = $createDiffNode('modify');
      $setNodeId(diff, 'legacy-diff');
      const before = $createDiffContentNode('before');
      $setNodeId(before, 'legacy-before-wrapper');
      const after = $createDiffContentNode('after');
      $setNodeId(after, 'legacy-after-wrapper');
      const beforeText = $createTextNode('Before');
      const afterText = $createTextNode('After');
      $setNodeId(beforeText, 'shared-text');
      $setNodeId(afterText, 'shared-text');
      before.append(beforeText);
      after.append(afterText);
      diff.append(before, after);
      root.append(diff);
    });
    await moment();

    const serialized = {
      children: [
        {
          children: [
            {
              children: [{ id: 'shared-text', text: 'Before', type: 'text' }],
              id: 'legacy-before-wrapper',
              side: 'before',
              type: 'diff-content',
            },
            {
              children: [{ id: 'shared-text', text: 'After', type: 'text' }],
              id: 'legacy-after-wrapper',
              side: 'after',
              type: 'diff-content',
            },
          ],
          diffType: 'modify',
          id: 'legacy-diff',
          type: 'diff',
        },
      ],
      id: 'legacy-root',
      type: 'root',
    };
    for (const id of [
      'legacy-root',
      'legacy-diff',
      'legacy-before-wrapper',
      'legacy-after-wrapper',
    ]) {
      expect(lookup(editor, id)).toBeNull();
      expect(hasActiveLiteXmlNodeId(serialized, id)).toBe(false);
    }
    expect(lookup(editor, 'shared-text')?.textContent).toBe('After');
    expect(hasActiveLiteXmlNodeId(serialized, 'shared-text')).toBe(true);
  });

  it('follows accept, reject, undo, and redo without retaining discarded review nodes', async () => {
    const editor = createEditor([LitexmlPlugin, CommonPlugin]);
    editor.setDocument(
      'litexml',
      '<root><p id="paragraph-one"><span id="text-one">Before</span></p></root>',
    );
    editor.dispatchCommand(LITEXML_APPLY_COMMAND, {
      delay: true,
      litexml: '<p id="paragraph-one">Accepted</p>',
    });
    await moment();
    expect(lookup(editor, 'paragraph-one')?.textContent).toBe('Accepted');
    editor.dispatchCommand(LITEXML_DIFFNODE_ALL_COMMAND, { action: DiffAction.Accept });
    await moment();
    expect(lookup(editor, 'paragraph-one')?.textContent).toBe('Accepted');
    const lexicalEditor = editor.getLexicalEditor()!;
    lexicalEditor.getEditorState().read(() => {
      expect(findLexicalNode($getRoot(), (node) => node.getType() === 'diff')).toBeNull();
    });

    editor.dispatchCommand(LITEXML_APPLY_COMMAND, {
      delay: true,
      litexml: '<p id="paragraph-one">Rejected</p>',
    });
    await moment();
    expect(lookup(editor, 'paragraph-one')?.textContent).toBe('Rejected');
    lexicalEditor.getEditorState().read(() => {
      expect(findLexicalNode($getRoot(), (node) => node.getType() === 'diff')).not.toBeNull();
    });
    editor.dispatchCommand(LITEXML_DIFFNODE_ALL_COMMAND, { action: DiffAction.Reject });
    await moment();
    expect(lookup(editor, 'paragraph-one')?.textContent).toBe('Accepted');

    lexicalEditor.update(
      () => {
        const paragraph = $getNodeById('paragraph-one');
        const text = $isElementNode(paragraph) ? paragraph.getFirstChild() : null;
        if (!$isTextNode(text)) throw new Error('Expected accepted text node.');
        text.setTextContent('Edited');
      },
      { tag: HISTORY_PUSH_TAG },
    );
    await moment();
    expect(lookup(editor, 'paragraph-one')?.textContent).toBe('Edited');
    lexicalEditor.dispatchCommand(UNDO_COMMAND, undefined);
    await moment();
    expect(lookup(editor, 'paragraph-one')?.textContent).toBe('Accepted');
    lexicalEditor.dispatchCommand(REDO_COMMAND, undefined);
    await moment();
    expect(lookup(editor, 'paragraph-one')?.textContent).toBe('Edited');
  });
});
