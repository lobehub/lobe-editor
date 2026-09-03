// @vitest-environment node
import { describe, expect, it } from 'vitest';
import {
  $createParagraphNode,
  $createRangeSelection,
  $createTextNode,
  $getState,
  $getRoot,
  $isElementNode,
  $isTextNode,
  $setState,
  $setSelection,
  SELECTION_INSERT_CLIPBOARD_NODES_COMMAND,
  REDO_COMMAND,
  UNDO_COMMAND,
} from 'lexical';
import { Doc } from 'yjs';

import { createHeadlessEditor } from '@/headless';
import {
  $getNodeProperties,
  $getNodeId,
  $findNodeById,
  $isNodeIdentityBlockTarget,
  $setNodeProperties,
  type AnnotationRecord,
  CREATE_ANNOTATION_COMMAND,
  IAnnotationService,
  MARK_AI_GENERATED_COMMAND,
  propertiesState,
} from '..';
import { AnnotationServiceImpl } from '../service/annotation';

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

describe('PropertiesPlugin', () => {
  it('migrates durable node IDs across supported blocks and JSON rehydration', async () => {
    const source = createHeadlessEditor();
    source.hydrateMarkdown('# Heading\n\nParagraph\n\n> Quote\n\n- Item');
    await flush();

    const sourceIds: Record<string, string> = {};
    source.kernel
      .getLexicalEditor()!
      .getEditorState()
      .read(() => {
        $getRoot()
          .getChildren()
          .forEach((node) => {
            if ($isNodeIdentityBlockTarget(node)) {
              const nodeId = $getNodeId(node);
              if (nodeId) sourceIds[node.getType()] = nodeId;
            }
          });
      });
    expect(sourceIds.heading).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );
    expect(sourceIds.paragraph).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );

    const exported = source.export().editorData;
    const target = createHeadlessEditor();
    target.hydrateEditorData(exported);
    await flush();

    target.kernel
      .getLexicalEditor()!
      .getEditorState()
      .read(() => {
        for (const nodeId of Object.values(sourceIds)) {
          const node = $findNodeById(nodeId);
          expect(node).not.toBeNull();
          expect($getNodeId(node!)).toBe(nodeId);
        }
      });

    source.destroy();
    target.destroy();
  });

  it('uses invisible Markdown markers to preserve block identities', async () => {
    const source = createHeadlessEditor();
    source.hydrateMarkdown('# Stable heading\n\nStable paragraph');
    await flush();
    const headingId = source.kernel
      .getLexicalEditor()!
      .getEditorState()
      .read(() => {
        const heading = $getRoot().getFirstChild();
        return heading ? $getNodeId(heading) : undefined;
      });
    const markdown = source.export({ includeNodeIds: true }).markdown;
    expect(markdown).toContain(`<!-- lobe-node-id:${headingId} -->`);

    const target = createHeadlessEditor();
    target.hydrateMarkdown(markdown);
    await flush();
    target.kernel
      .getLexicalEditor()!
      .getEditorState()
      .read(() => {
        expect(headingId).toBeTruthy();
        expect($findNodeById(headingId!)).not.toBeNull();
      });
    source.destroy();
    target.destroy();
  });

  it('allocates fresh IDs and strips annotations for clipboard insertions', async () => {
    const headless = createHeadlessEditor();
    const lexical = headless.kernel.getLexicalEditor()!;
    let originalId = '';
    let copiedId = '';

    lexical.update(() => {
      const source = $createParagraphNode().append($createTextNode('copied block'));
      $setNodeProperties(source, {
        annotationIds: ['private-comment'],
        nodeId: 'source-node-id',
      });
      originalId = $getNodeId(source)!;
      lexical.dispatchCommand(SELECTION_INSERT_CLIPBOARD_NODES_COMMAND, {
        nodes: [source],
        selection: null,
      } as any);
      copiedId = $getNodeId(source)!;
      expect(copiedId).not.toBe(originalId);
      expect($getNodeProperties(source).annotationIds).toBeUndefined();
    });
    await flush();
    expect(copiedId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );
    headless.destroy();
  });

  it('stores sparse properties on arbitrary nodes and preserves them in JSON only', async () => {
    const headless = createHeadlessEditor();
    headless.hydrateMarkdown('Hello world');
    const lexical = headless.kernel.getLexicalEditor()!;

    lexical.update(() => {
      const paragraph = $getRoot().getFirstChild()!;
      if (!$isElementNode(paragraph)) throw new Error('Expected paragraph');
      const text = paragraph.getFirstChild()!;
      $setNodeProperties(paragraph, { custom: 'block' });
      $setNodeProperties(text, {
        provenance: { generationId: 'generation-1', source: 'ai' },
      });
    });
    await flush();

    const snapshot = headless.export({ litexml: true });
    const paragraph = snapshot.editorData.root.children[0] as any;
    const text = paragraph.children[0] as any;
    expect(paragraph.$.properties.custom).toBe('block');
    expect(text.$.properties.provenance).toMatchObject({
      generationId: 'generation-1',
      source: 'ai',
    });
    expect(snapshot.markdown).not.toContain('generation-1');
    expect(snapshot.litexml).not.toContain('generation-1');
    headless.destroy();
  });

  it('creates a range annotation with one shared id and persists its repository', async () => {
    const headless = createHeadlessEditor();
    headless.hydrateMarkdown('Hello world');
    const lexical = headless.kernel.getLexicalEditor()!;

    lexical.update(() => {
      const paragraph = $getRoot().getFirstChild()!;
      if (!$isElementNode(paragraph)) throw new Error('Expected paragraph');
      const text = paragraph.getFirstChild()!;
      if (!$isTextNode(text)) throw new Error('Expected text node');
      const selection = $createRangeSelection();
      selection.anchor.set(text.getKey(), 0, 'text');
      selection.focus.set(text.getKey(), 5, 'text');
      $setSelection(selection);
      lexical.dispatchCommand(CREATE_ANNOTATION_COMMAND, {
        id: 'comment-1',
        kind: 'comment',
        payload: { text: 'Nice' },
      });
    });
    await flush();

    const service = headless.kernel.requireService(IAnnotationService)!;
    expect(service.get('comment-1')).toMatchObject({
      quotedText: 'Hello',
      status: 'active',
    });
    const textNodes: any[] = [];
    lexical.getEditorState().read(() => {
      $getRoot()
        .getAllTextNodes()
        .forEach((node) => textNodes.push($getNodeProperties(node)));
    });
    expect(textNodes.find((properties) => properties.annotationIds)?.annotationIds).toEqual([
      'comment-1',
    ]);
    expect(
      (headless.export().editorData.root as any).$.properties.document.annotations,
    ).toHaveLength(1);
    headless.destroy();
  });

  it('keeps comment creation in its own history entry and round-trips anchors through undo/redo', async () => {
    const headless = createHeadlessEditor();
    headless.hydrateMarkdown('Hello');
    await flush();
    const lexical = headless.kernel.getLexicalEditor()!;
    const service = headless.kernel.requireService(IAnnotationService)!;
    service.setStorageMode('external');

    lexical.update(() => {
      const text = $getRoot().getAllTextNodes()[0];
      text.setTextContent('Hello edited');
    });
    await flush();

    lexical.update(() => {
      const text = $getRoot().getAllTextNodes()[0];
      const selection = $createRangeSelection();
      selection.anchor.set(text.getKey(), 0, 'text');
      selection.focus.set(text.getKey(), 5, 'text');
      $setSelection(selection);
      lexical.dispatchCommand(CREATE_ANNOTATION_COMMAND, {
        id: 'history-comment',
        payload: { text: 'separate history' },
      });
    });
    await flush();

    const readAnnotationIds = () =>
      lexical.getEditorState().read(() =>
        $getRoot()
          .getAllTextNodes()
          .flatMap((node) => $getNodeProperties(node).annotationIds ?? []),
      );

    expect(readAnnotationIds()).toContain('history-comment');
    expect(service.get('history-comment')?.status).toBe('active');

    lexical.dispatchCommand(UNDO_COMMAND, undefined);
    await flush();
    expect(lexical.getEditorState().read(() => $getRoot().getTextContent())).toBe('Hello edited');
    expect(readAnnotationIds()).not.toContain('history-comment');
    expect(service.get('history-comment')).toMatchObject({ status: 'orphaned', nodeKeys: [] });

    lexical.dispatchCommand(REDO_COMMAND, undefined);
    await flush();
    expect(lexical.getEditorState().read(() => $getRoot().getTextContent())).toBe('Hello edited');
    expect(readAnnotationIds()).toContain('history-comment');
    expect(service.get('history-comment')).toMatchObject({
      status: 'active',
      nodeKeys: expect.any(Array),
    });
    headless.destroy();
  });

  it('marks autocomplete-style content as AI without replacing provenance on edits', async () => {
    const headless = createHeadlessEditor();
    headless.hydrateMarkdown('Text');
    const lexical = headless.kernel.getLexicalEditor()!;

    lexical.update(() => {
      const paragraph = $getRoot().getFirstChild()!;
      if (!$isElementNode(paragraph)) throw new Error('Expected paragraph');
      const text = paragraph.getFirstChild()!;
      lexical.dispatchCommand(MARK_AI_GENERATED_COMMAND, {
        generationId: 'suggestion-1',
        nodeKeys: [text.getKey()],
      });
    });
    await flush();

    lexical.update(() => {
      const paragraph = $getRoot().getFirstChild()!;
      if (!$isElementNode(paragraph)) throw new Error('Expected paragraph');
      const text = paragraph.getFirstChild()!;
      if ($isTextNode(text)) text.setTextContent(`${text.getTextContent()} edited`);
    });
    await flush();

    let properties: ReturnType<typeof $getNodeProperties> | null = null;
    lexical.getEditorState().read(() => {
      const paragraph = $getRoot().getFirstChild();
      if ($isElementNode(paragraph)) {
        const text = paragraph.getFirstChild();
        if (text) properties = $getNodeProperties(text);
      }
    });
    expect((properties as any)?.provenance).toMatchObject({
      generationId: 'suggestion-1',
      source: 'ai',
    });
    headless.destroy();
  });

  it('keeps an annotation orphaned after deletion and reactivates it after undo', async () => {
    const headless = createHeadlessEditor();
    headless.hydrateMarkdown('Undo me');
    const lexical = headless.kernel.getLexicalEditor()!;

    lexical.update(() => {
      const paragraph = $getRoot().getFirstChild()!;
      if (!$isElementNode(paragraph)) throw new Error('Expected paragraph');
      const text = paragraph.getFirstChild()!;
      if (!$isTextNode(text)) throw new Error('Expected text');
      const selection = $createRangeSelection();
      selection.anchor.set(text.getKey(), 0, 'text');
      selection.focus.set(text.getKey(), text.getTextContentSize(), 'text');
      $setSelection(selection);
      lexical.dispatchCommand(CREATE_ANNOTATION_COMMAND, {
        id: 'undo-comment',
        payload: 'keep me',
      });
    });
    await flush();

    lexical.update(() => {
      $getRoot().clear();
    });
    await flush();
    expect(headless.kernel.requireService(IAnnotationService)?.get('undo-comment')?.status).toBe(
      'orphaned',
    );

    lexical.dispatchCommand(UNDO_COMMAND, undefined);
    await flush();
    expect(headless.kernel.requireService(IAnnotationService)?.get('undo-comment')?.status).toBe(
      'active',
    );
    let restoredAnnotationIds: string[] = [];
    lexical.getEditorState().read(() => {
      restoredAnnotationIds = $getRoot()
        .getAllTextNodes()
        .flatMap((node) => $getNodeProperties(node).annotationIds ?? []);
    });
    expect(restoredAnnotationIds).toContain('undo-comment');
    headless.destroy();
  });

  it('strips annotation ids from internal clipboard nodes but keeps AI provenance', async () => {
    const headless = createHeadlessEditor();
    const lexical = headless.kernel.getLexicalEditor()!;
    let properties: any = null;

    lexical.update(() => {
      const source = $createTextNode('copied');
      $setState(source, propertiesState, {
        annotationIds: ['comment-clipboard'],
        provenance: { generationId: 'ai-clipboard', source: 'ai' },
      });
      lexical.dispatchCommand(SELECTION_INSERT_CLIPBOARD_NODES_COMMAND, {
        nodes: [source],
        selection: null,
      } as any);
      properties = $getState(source, propertiesState);
    });
    await flush();

    expect(properties.annotationIds).toBeUndefined();
    expect(properties.provenance).toMatchObject({
      generationId: 'ai-clipboard',
      source: 'ai',
    });
    headless.destroy();
  });

  it('annotates forward and reverse cross-node partial selections without touching boundaries', async () => {
    for (const { id, reverse } of [
      { id: 'cross-forward', reverse: false },
      { id: 'cross-reverse', reverse: true },
    ]) {
      const headless = createHeadlessEditor();
      headless.hydrateMarkdown('Hello\n\nWorld');
      const lexical = headless.kernel.getLexicalEditor()!;

      lexical.update(() => {
        const textNodes = $getRoot().getAllTextNodes();
        const first = textNodes[0];
        const second = textNodes[1];
        const selection = $createRangeSelection();
        if (reverse) {
          selection.anchor.set(second.getKey(), 3, 'text');
          selection.focus.set(first.getKey(), 2, 'text');
        } else {
          selection.anchor.set(first.getKey(), 2, 'text');
          selection.focus.set(second.getKey(), 3, 'text');
        }
        $setSelection(selection);
        lexical.dispatchCommand(CREATE_ANNOTATION_COMMAND, { id, payload: id });
      });
      await flush();

      const annotated: Array<{ ids: string[]; text: string }> = [];
      lexical.getEditorState().read(() => {
        for (const node of $getRoot().getAllTextNodes()) {
          annotated.push({
            ids: $getNodeProperties(node).annotationIds ?? [],
            text: node.getTextContent(),
          });
        }
      });
      expect(annotated).toEqual(
        expect.arrayContaining([
          { ids: [], text: 'He' },
          { ids: [id], text: 'llo' },
          { ids: [id], text: 'Wor' },
          { ids: [], text: 'ld' },
        ]),
      );
      headless.destroy();
    }
  });

  it('keeps overlapping annotation ids and orders repository records by createdAt', async () => {
    const headless = createHeadlessEditor();
    headless.hydrateMarkdown('abcdef');
    const lexical = headless.kernel.getLexicalEditor()!;

    lexical.update(() => {
      const text = $getRoot().getAllTextNodes()[0];
      const selection = $createRangeSelection();
      selection.anchor.set(text.getKey(), 0, 'text');
      selection.focus.set(text.getKey(), 4, 'text');
      $setSelection(selection);
      lexical.dispatchCommand(CREATE_ANNOTATION_COMMAND, { id: 'annotation-a', payload: 'a' });
    });
    await flush();

    lexical.update(() => {
      const textNodes = $getRoot().getAllTextNodes();
      const first = textNodes.find((node) => node.getTextContent() === 'abcd')!;
      const second = textNodes.find((node) => node.getTextContent() === 'ef')!;
      const selection = $createRangeSelection();
      selection.anchor.set(first.getKey(), 2, 'text');
      selection.focus.set(second.getKey(), 1, 'text');
      $setSelection(selection);
      lexical.dispatchCommand(CREATE_ANNOTATION_COMMAND, { id: 'annotation-b', payload: 'b' });
    });
    await flush();

    const overlapping = lexical.getEditorState().read(() =>
      $getRoot()
        .getAllTextNodes()
        .find((node) => node.getTextContent() === 'cd'),
    );
    let overlappingIds: string[] = [];
    lexical.getEditorState().read(() => {
      const node = $getRoot()
        .getAllTextNodes()
        .find((candidate) => candidate.getTextContent() === 'cd');
      if (node) overlappingIds = $getNodeProperties(node).annotationIds ?? [];
    });
    expect(overlapping).not.toBeUndefined();
    expect(overlappingIds).toEqual(['annotation-a', 'annotation-b']);

    const service = headless.kernel.requireService(IAnnotationService)!;
    service.update('annotation-a', { createdAt: '2024-01-01T00:00:00.000Z' });
    service.update('annotation-b', { createdAt: '2023-01-01T00:00:00.000Z' });
    expect(service.getAll().map((record) => record.id)).toEqual(['annotation-b', 'annotation-a']);
    headless.destroy();
  });

  it('reloads JSON with node anchors and the document annotation repository', async () => {
    const source = createHeadlessEditor();
    source.hydrateMarkdown('Reload me');
    const sourceLexical = source.kernel.getLexicalEditor()!;
    sourceLexical.update(() => {
      const text = $getRoot().getAllTextNodes()[0];
      const selection = $createRangeSelection();
      selection.anchor.set(text.getKey(), 0, 'text');
      selection.focus.set(text.getKey(), 6, 'text');
      $setSelection(selection);
      sourceLexical.dispatchCommand(CREATE_ANNOTATION_COMMAND, {
        id: 'reload-comment',
        payload: { source: 'test' },
      });
    });
    await flush();
    const editorData = source.export().editorData;

    const target = createHeadlessEditor();
    target.hydrateEditorData(editorData);
    await flush();
    expect(target.kernel.requireService(IAnnotationService)?.get('reload-comment')).toMatchObject({
      payload: { source: 'test' },
      status: 'active',
    });
    let hasReloadAnchor = false;
    target.kernel
      .getLexicalEditor()!
      .getEditorState()
      .read(() => {
        hasReloadAnchor = $getRoot()
          .getAllTextNodes()
          .some((node) =>
            ($getNodeProperties(node).annotationIds ?? []).includes('reload-comment'),
          );
      });
    expect(hasReloadAnchor).toBe(true);
    source.destroy();
    target.destroy();
  });

  it('does not orphan an active external record while its anchor has not hydrated yet', async () => {
    const headless = createHeadlessEditor();
    headless.hydrateMarkdown('Hydrate anchor later');
    await flush();
    const lexical = headless.kernel.getLexicalEditor()!;
    const service = headless.kernel.requireService(IAnnotationService)!;
    service.setStorageMode('external');

    service.importSnapshot([
      {
        createdAt: '2024-01-01T00:00:00.000Z',
        id: 'late-anchor',
        kind: 'comment',
        payload: { text: 'database record' },
        quotedText: 'Hydrate',
        status: 'active',
        updatedAt: '2024-01-01T00:00:00.000Z',
      },
    ]);
    await flush();
    expect(service.get('late-anchor')?.status).toBe('active');

    lexical.update(() => {
      const text = $getRoot().getAllTextNodes()[0];
      $setNodeProperties(text, { annotationIds: ['late-anchor'] });
    });
    await flush();

    expect(service.get('late-anchor')).toMatchObject({
      nodeKeys: expect.any(Array),
      status: 'active',
    });
    headless.destroy();
  });

  it('reactivates an imported orphan immediately when the hydrated editor already has its anchor', async () => {
    const headless = createHeadlessEditor();
    headless.hydrateMarkdown('Already anchored');
    await flush();
    const lexical = headless.kernel.getLexicalEditor()!;
    const service = headless.kernel.requireService(IAnnotationService)!;
    service.setStorageMode('external');

    lexical.update(() => {
      const text = $getRoot().getAllTextNodes()[0];
      $setNodeProperties(text, { annotationIds: ['hydrated-anchor'] });
    });
    await flush();

    service.importSnapshot([
      {
        createdAt: '2024-01-01T00:00:00.000Z',
        id: 'hydrated-anchor',
        kind: 'comment',
        payload: { text: 'database record' },
        quotedText: 'Already',
        status: 'orphaned',
        updatedAt: '2024-01-01T00:00:00.000Z',
      },
    ]);
    await flush();

    expect(service.get('hydrated-anchor')).toMatchObject({
      nodeKeys: expect.any(Array),
      status: 'active',
    });
    headless.destroy();
  });

  it('does not loop when import reconciliation updates an external record', async () => {
    const headless = createHeadlessEditor();
    headless.hydrateMarkdown('No reconciliation loop');
    await flush();
    const lexical = headless.kernel.getLexicalEditor()!;
    const service = headless.kernel.requireService(IAnnotationService)!;
    service.setStorageMode('external');
    lexical.update(() => {
      const text = $getRoot().getAllTextNodes()[0];
      $setNodeProperties(text, { annotationIds: ['loop-free'] });
    });
    await flush();

    let localUpdateCount = 0;
    service.subscribeMutations((mutation) => {
      if (mutation.source === 'local' && mutation.type === 'update') localUpdateCount += 1;
    });
    service.importSnapshot([
      {
        createdAt: '2024-01-01T00:00:00.000Z',
        id: 'loop-free',
        kind: 'comment',
        payload: { text: 'database record' },
        quotedText: 'No reconciliation',
        status: 'orphaned',
        updatedAt: '2024-01-01T00:00:00.000Z',
      },
    ]);
    await flush();
    await flush();

    expect(localUpdateCount).toBe(1);
    expect(service.get('loop-free')?.status).toBe('active');
    headless.destroy();
  });

  it('keeps concurrent annotation additions isolated in a shared Y.Map', () => {
    const doc = new Doc();
    const map = doc.getMap<AnnotationRecord>('lobe:annotations');
    const left = new AnnotationServiceImpl();
    const right = new AnnotationServiceImpl();
    left.attachYMap(map);
    right.attachYMap(map);

    left.create({ id: 'left', payload: { side: 'left' } });
    right.create({ id: 'right', payload: { side: 'right' } });

    expect(left.getAll().map((record) => record.id)).toEqual(['left', 'right']);
    expect(right.getAll().map((record) => record.id)).toEqual(['left', 'right']);
    expect(left.get('left')?.payload).toEqual({ side: 'left' });
    expect(right.get('right')?.payload).toEqual({ side: 'right' });
    doc.destroy();
  });

  it('keeps external annotation bodies out of Y.Map and emits service mutations', () => {
    const doc = new Doc();
    const map = doc.getMap<AnnotationRecord>('lobe:annotations');
    const service = new AnnotationServiceImpl({ storageMode: 'external' });
    const mutations: Array<{ type: string; source: string; id?: string }> = [];
    service.subscribeMutations((mutation) => {
      mutations.push({ type: mutation.type, source: mutation.source, id: mutation.id });
    });
    service.attachYMap(map);

    service.create({ id: 'external-create', payload: { text: 'created' } });
    service.update('external-create', { payload: { text: 'updated' } });
    service.remove('external-create');
    service.importSnapshot([
      {
        createdAt: '2024-01-01T00:00:00.000Z',
        id: 'external-import',
        kind: 'comment',
        payload: { text: 'imported' },
        quotedText: 'quoted',
        status: 'active',
        updatedAt: '2024-01-01T00:00:00.000Z',
      },
    ]);

    expect(map.size).toBe(0);
    expect(service.get('external-import')?.payload).toEqual({ text: 'imported' });
    expect(mutations).toEqual([
      { id: 'external-create', source: 'local', type: 'create' },
      { id: 'external-create', source: 'local', type: 'update' },
      { id: 'external-create', source: 'local', type: 'remove' },
      { id: undefined, source: 'import', type: 'import' },
    ]);
    doc.destroy();
  });

  it('reads legacy Y.Map records once for external migration without observing or writing them', () => {
    const doc = new Doc();
    const map = doc.getMap<AnnotationRecord>('lobe:annotations');
    const legacy: AnnotationRecord = {
      createdAt: '2024-01-01T00:00:00.000Z',
      id: 'legacy-comment',
      kind: 'comment',
      payload: { text: 'legacy' },
      quotedText: 'quoted',
      status: 'active',
      updatedAt: '2024-01-01T00:00:00.000Z',
    };
    map.set(legacy.id, legacy);

    const service = new AnnotationServiceImpl({ storageMode: 'external' });
    const migrations: string[][] = [];
    service.subscribeMutations((mutation) => {
      if (mutation.type === 'migration') {
        migrations.push((mutation.records ?? []).map((record) => record.id));
      }
    });
    service.attachYMap(map);
    service.attachYMap(map);

    expect(service.get('legacy-comment')).toMatchObject({ payload: { text: 'legacy' } });
    expect(map.get('legacy-comment')).toEqual(legacy);
    expect(migrations).toEqual([['legacy-comment']]);
    doc.destroy();
  });

  it('omits external annotation records from JSON metadata while preserving node anchors', async () => {
    const headless = createHeadlessEditor();
    const service = headless.kernel.requireService(IAnnotationService)!;
    service.setStorageMode('external');
    headless.hydrateMarkdown('External comment');
    const lexical = headless.kernel.getLexicalEditor()!;

    lexical.update(() => {
      const text = $getRoot().getAllTextNodes()[0];
      const selection = $createRangeSelection();
      selection.anchor.set(text.getKey(), 0, 'text');
      selection.focus.set(text.getKey(), 'External'.length, 'text');
      $setSelection(selection);
      lexical.dispatchCommand(CREATE_ANNOTATION_COMMAND, {
        id: 'external-json-comment',
        payload: { text: 'stored outside the document' },
      });
    });
    await flush();

    const root = headless.export().editorData.root as any;
    expect(root.$?.properties?.document?.annotations).toBeUndefined();
    expect(root.children[0].children[0].$?.properties?.annotationIds).toEqual([
      'external-json-comment',
    ]);
    expect(service.get('external-json-comment')?.payload).toEqual({
      text: 'stored outside the document',
    });
    headless.destroy();
  });
});
