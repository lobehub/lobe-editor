import { createBinding, type Provider } from '@lexical/yjs';
import { applyUpdate, Doc, encodeStateAsUpdate } from 'yjs';

import { moment } from '@/editor-kernel';
import { Kernel } from '@/editor-kernel/kernel';
import { CommonPlugin } from '@/plugins/common';
import { LITEXML_APPLY_COMMAND, LitexmlPlugin } from '@/plugins/litexml';
import { ListPlugin } from '@/plugins/list/plugin';
import { MarkdownPlugin } from '@/plugins/markdown';
import { TablePlugin } from '@/plugins/table';

import { YjsService } from '../service';

if (!globalThis.ResizeObserver) {
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as typeof ResizeObserver;
}

const createProvider = (): Provider => ({
  awareness: {
    getLocalState: () => null,
    getStates: () => new Map(),
    off: () => undefined,
    on: () => undefined,
    setLocalState: () => undefined,
    setLocalStateField: () => undefined,
  },
  connect: () => undefined,
  disconnect: () => undefined,
  off: () => undefined,
  on: () => undefined,
});

const createEditor = () => {
  const editor = new Kernel();
  editor.registerPlugins([CommonPlugin, MarkdownPlugin, TablePlugin]);
  editor.setRootElement(document.createElement('div'));
  return editor;
};

const getShape = (editor: Kernel) => {
  const root = (editor.getDocument('json') as any).root;
  const table = root.children.find((node: any) => node.type === 'table');

  return {
    cells: table?.children.reduce((total: number, row: any) => total + row.children.length, 0),
    paragraphs: root.children.filter((node: any) => node.type === 'paragraph').length,
    rows: table?.children.length,
  };
};

const collectNodeIds = (node: any): string[] => {
  const id = node?.$?.properties?.nodeId;
  return [
    ...(typeof id === 'string' ? [id] : []),
    ...(Array.isArray(node?.children) ? node.children.flatMap(collectNodeIds) : []),
  ];
};

const removeSerializedNodeIds = (node: any): void => {
  if (!node || typeof node !== 'object') return;
  delete node.id;
  if (node.$?.properties) {
    delete node.$.properties.nodeId;
    if (Object.keys(node.$.properties).length === 0) delete node.$.properties;
    if (Object.keys(node.$).length === 0) delete node.$;
  }
  node.children?.forEach(removeSerializedNodeIds);
};

describe('YjsService external snapshots', () => {
  it('preserves a legacy dup-prefixed repair ID when replaying its malformed source snapshot', () => {
    const editor = new Kernel();
    editor.registerPlugins([CommonPlugin, MarkdownPlugin]);
    editor.setRootElement(document.createElement('div'));
    editor.setDocument('markdown', 'Alpha\n\nBeta');

    const baseSnapshot = structuredClone(editor.getDocument('json')) as any;
    const legacySnapshot = structuredClone(baseSnapshot);
    const malformedSnapshot = structuredClone(baseSnapshot);
    const legacyRepairId = 'dup-ea80aa2b445b6394a65762d75b63895a';
    const setParagraphId = (paragraph: any, nodeId: string) => {
      paragraph.id = nodeId;
      paragraph.$ = { ...paragraph.$, properties: { ...paragraph.$?.properties, nodeId } };
    };

    setParagraphId(legacySnapshot.root.children[0], 'duplicate-paragraph');
    setParagraphId(legacySnapshot.root.children[1], legacyRepairId);
    malformedSnapshot.root.children.forEach((paragraph: any) =>
      setParagraphId(paragraph, 'duplicate-paragraph'),
    );
    editor.setDocument('json', legacySnapshot, { keepId: true });

    const doc = new Doc();
    const provider = createProvider();
    const binding = createBinding(
      editor.getLexicalEditor()!,
      provider,
      'legacy-duplicate-page',
      doc,
      new Map(),
    );
    const service = new YjsService();
    service.setState({
      binding,
      doc,
      docMap: new Map(),
      id: 'legacy-duplicate-page',
      provider,
    });

    expect(service.applyExternalEditorData(malformedSnapshot)).toBe(true);
    const ids = (editor.getDocument('json') as any).root.children.map(
      (paragraph: any) => paragraph.$.properties.nodeId,
    );
    expect(ids).toEqual(['duplicate-paragraph', legacyRepairId]);
    expect(service.applyExternalEditorData(malformedSnapshot)).toBe(false);
    expect(
      (editor.getDocument('json') as any).root.children.map(
        (paragraph: any) => paragraph.$.properties.nodeId,
      ),
    ).toEqual(ids);

    editor.destroy();
  });

  it('replays a deeply nested duplicate list with quoted content without identity churn', () => {
    const editor = new Kernel();
    editor.registerPlugins([CommonPlugin, LitexmlPlugin, ListPlugin]);
    editor.setRootElement(document.createElement('div'));
    const nestedList = (text: string, id: string) => {
      let content = `<span>${text}</span>`;
      for (let level = 0; level < 12; level++) content = `<ul><li>${content}</li></ul>`;
      return content.replace('<ul>', `<ul id="${id}">`);
    };
    editor.setDocument(
      'litexml',
      `<root>${nestedList('A &quot;quoted&quot; \\ value', 'nested-a')}${nestedList('B &quot;quoted&quot; \\ value', 'nested-b')}</root>`,
    );
    const snapshot = structuredClone(editor.getDocument('json')) as any;
    const listDepth = (node: any): number =>
      (node.type === 'list' ? 1 : 0) +
      (Array.isArray(node.children) ? Math.max(0, ...node.children.map(listDepth)) : 0);
    expect(snapshot.root.children).toHaveLength(2);
    expect(listDepth(snapshot.root.children[0])).toBeGreaterThanOrEqual(10);
    for (const [index, list] of snapshot.root.children.entries()) {
      list.id = 'duplicate-nested-list';
      list.$ = {
        ...list.$,
        properties: {
          ...list.$?.properties,
          nodeId: 'duplicate-nested-list',
          payload: { id: `application-${index}`, nested: { id: `child-${index}` } },
        },
      };
    }
    const originalInput = structuredClone(snapshot);

    const doc = new Doc();
    const provider = createProvider();
    const binding = createBinding(
      editor.getLexicalEditor()!,
      provider,
      'nested-page',
      doc,
      new Map(),
    );
    const service = new YjsService();
    service.setState({ binding, doc, docMap: new Map(), id: 'nested-page', provider });
    expect([
      service.applyExternalEditorData(snapshot),
      service.applyExternalEditorData(snapshot),
      service.applyExternalEditorData(snapshot),
    ]).toEqual([true, false, false]);
    const lists = (editor.getDocument('json') as any).root.children;
    const ids = lists.map((list: any) => list.$.properties.nodeId);
    expect(ids[0]).toBe('duplicate-nested-list');
    expect(ids[1]).toMatch(/^[0-9a-z]{10}$/);
    expect(lists[1].$.properties.payload).toEqual({
      id: 'application-1',
      nested: { id: 'child-1' },
    });
    const reorderedMetadata = structuredClone(snapshot);
    reorderedMetadata.root.children[1].$.properties.payload = {
      nested: { id: 'child-1' },
      id: 'application-1',
    };
    service.applyExternalEditorData(reorderedMetadata);
    expect((editor.getDocument('json') as any).root.children[1].$.properties.nodeId).toBe(ids[1]);
    expect(snapshot).toEqual(originalInput);
    editor.destroy();
  });

  it('preserves a legitimate review before/after identity pair', async () => {
    const editor = new Kernel();
    editor.registerPlugins([CommonPlugin, LitexmlPlugin]);
    editor.setRootElement(document.createElement('div'));
    editor.setDocument('litexml', '<root><p id="review-paragraph">Before</p></root>');
    editor.dispatchCommand(LITEXML_APPLY_COMMAND, {
      delay: true,
      litexml: '<p id="review-paragraph">After</p>',
    });
    await moment();
    const snapshot = editor.getDocument('json') as unknown as Record<string, any>;
    expect(collectNodeIds(snapshot.root).filter((id) => id === 'review-paragraph')).toHaveLength(2);

    const doc = new Doc();
    const provider = createProvider();
    const binding = createBinding(
      editor.getLexicalEditor()!,
      provider,
      'review-page',
      doc,
      new Map(),
    );
    const service = new YjsService();
    service.setState({ binding, doc, docMap: new Map(), id: 'review-page', provider });
    expect(service.applyExternalEditorData(snapshot)).toBe(true);
    expect(service.applyExternalEditorData(snapshot)).toBe(false);
    expect(
      collectNodeIds((editor.getDocument('json') as any).root).filter(
        (id) => id === 'review-paragraph',
      ),
    ).toHaveLength(2);
    editor.destroy();
  });

  it('repairs duplicate explicit IDs once across clients and keeps the original owner after insertion', () => {
    const editorA = createEditor();
    const editorB = createEditor();
    const docA = new Doc();
    const docB = new Doc();
    const providerA = createProvider();
    const providerB = createProvider();
    const bindingA = createBinding(
      editorA.getLexicalEditor()!,
      providerA,
      'duplicate-page',
      docA,
      new Map(),
    );
    const bindingB = createBinding(
      editorB.getLexicalEditor()!,
      providerB,
      'duplicate-page',
      docB,
      new Map(),
    );
    const serviceA = new YjsService();
    const serviceB = new YjsService();
    serviceA.setState({
      binding: bindingA,
      doc: docA,
      docMap: new Map(),
      id: 'duplicate-page',
      provider: providerA,
    });
    serviceB.setState({
      binding: bindingB,
      doc: docB,
      docMap: new Map(),
      id: 'duplicate-page',
      provider: providerB,
    });

    editorA.setDocument('markdown', 'Alpha\n\nBeta');
    const duplicateSnapshot = structuredClone(editorA.getDocument('json')) as any;
    for (const paragraph of duplicateSnapshot.root.children) {
      paragraph.id = 'duplicate-paragraph';
      paragraph.$ = {
        ...paragraph.$,
        properties: { ...paragraph.$?.properties, nodeId: 'duplicate-paragraph' },
      };
      const text = paragraph.children[0];
      text.id = 'duplicate-text';
      text.$ = { ...text.$, properties: { ...text.$?.properties, nodeId: 'duplicate-text' } };
    }
    const originalInput = structuredClone(duplicateSnapshot);

    expect(serviceA.applyExternalEditorData(duplicateSnapshot)).toBe(true);
    const firstRoot = (editorA.getDocument('json') as any).root;
    const firstIds = collectNodeIds(firstRoot);
    expect(firstIds).toHaveLength(4);
    expect(new Set(firstIds).size).toBe(4);
    expect(firstRoot.children[0].$.properties.nodeId).toBe('duplicate-paragraph');
    expect(firstRoot.children[0].children[0].$.properties.nodeId).toBe('duplicate-text');
    expect(serviceA.applyExternalEditorData(duplicateSnapshot)).toBe(false);
    expect(collectNodeIds((editorA.getDocument('json') as any).root)).toEqual(firstIds);
    expect(duplicateSnapshot).toEqual(originalInput);

    applyUpdate(docB, encodeStateAsUpdate(docA));
    expect(serviceB.applyExternalEditorData(duplicateSnapshot)).toBe(false);
    expect(collectNodeIds((editorB.getDocument('json') as any).root)).toEqual(firstIds);

    const reorderedSnapshot = structuredClone(duplicateSnapshot);
    reorderedSnapshot.root.children.reverse();
    expect(serviceA.applyExternalEditorData(reorderedSnapshot)).toBe(true);
    const reordered = (editorA.getDocument('json') as any).root.children;
    expect(reordered.map((node: any) => node.children[0].text)).toEqual(['Beta', 'Alpha']);
    expect(reordered[0].$.properties.nodeId).toBe(firstRoot.children[1].$.properties.nodeId);
    expect(reordered[1].$.properties.nodeId).toBe('duplicate-paragraph');
    expect(serviceA.applyExternalEditorData(reorderedSnapshot)).toBe(false);
    expect(serviceA.applyExternalEditorData(duplicateSnapshot)).toBe(true);

    const insertedSnapshot = structuredClone(duplicateSnapshot);
    const inserted = structuredClone(insertedSnapshot.root.children[0]);
    inserted.children[0].text = 'Inserted C';
    insertedSnapshot.root.children.unshift(inserted);
    expect(serviceA.applyExternalEditorData(insertedSnapshot)).toBe(true);
    const insertedRoot = (editorA.getDocument('json') as any).root;
    expect(insertedRoot.children.map((node: any) => node.children[0].text)).toEqual([
      'Inserted C',
      'Alpha',
      'Beta',
    ]);
    expect(insertedRoot.children[0].$.properties.nodeId).not.toBe('duplicate-paragraph');
    expect(insertedRoot.children[1].$.properties.nodeId).toBe('duplicate-paragraph');
    expect(insertedRoot.children[2].$.properties.nodeId).toBe(
      firstRoot.children[1].$.properties.nodeId,
    );
    expect(serviceA.applyExternalEditorData(insertedSnapshot)).toBe(false);
    applyUpdate(docB, encodeStateAsUpdate(docA));
    // The remote Yjs update may arrive before this test binding hydrates its
    // populated Lexical tree; that client applies once, then replays as a no-op.
    expect(serviceB.applyExternalEditorData(insertedSnapshot)).toBe(true);
    expect(serviceB.applyExternalEditorData(insertedSnapshot)).toBe(false);
    expect(collectNodeIds((editorB.getDocument('json') as any).root)).toEqual(
      collectNodeIds(insertedRoot),
    );

    const editedSnapshot = structuredClone(insertedSnapshot);
    editedSnapshot.root.children[2].children[0].text = 'Beta edited';
    expect(serviceA.applyExternalEditorData(editedSnapshot)).toBe(true);
    const editedIds = collectNodeIds((editorA.getDocument('json') as any).root);
    expect(editorA.getDocument('text')).toContain('Beta edited');
    expect(serviceA.applyExternalEditorData(editedSnapshot)).toBe(false);
    expect(collectNodeIds((editorA.getDocument('json') as any).root)).toEqual(editedIds);

    const uniqueSnapshot = structuredClone(editedSnapshot);
    const changed = uniqueSnapshot.root.children[2];
    changed.id = 'explicit-unique-paragraph';
    changed.$.properties.nodeId = 'explicit-unique-paragraph';
    expect(serviceA.applyExternalEditorData(uniqueSnapshot)).toBe(true);
    expect((editorA.getDocument('json') as any).root.children[2].$.properties.nodeId).toBe(
      'explicit-unique-paragraph',
    );
    expect(serviceA.applyExternalEditorData(uniqueSnapshot)).toBe(false);
    expect(duplicateSnapshot).toEqual(originalInput);

    editorA.destroy();
    editorB.destroy();
  });

  it('replays legacy and mixed-ID snapshots idempotently and preserves front-inserted identities', () => {
    const editorA = createEditor();
    const editorB = createEditor();
    const docA = new Doc();
    const docB = new Doc();
    const providerA = createProvider();
    const providerB = createProvider();
    const bindingA = createBinding(
      editorA.getLexicalEditor()!,
      providerA,
      'legacy-page',
      docA,
      new Map(),
    );
    const bindingB = createBinding(
      editorB.getLexicalEditor()!,
      providerB,
      'legacy-page',
      docB,
      new Map(),
    );
    const serviceA = new YjsService();
    const serviceB = new YjsService();
    serviceA.setState({
      binding: bindingA,
      doc: docA,
      docMap: new Map(),
      id: 'legacy-page',
      provider: providerA,
    });
    serviceB.setState({
      binding: bindingB,
      doc: docB,
      docMap: new Map(),
      id: 'legacy-page',
      provider: providerB,
    });

    editorA.setDocument('markdown', 'Legacy snapshot paragraph');
    const snapshot = editorA.getDocument('json') as unknown as Record<string, any>;
    const legacySnapshot = structuredClone(snapshot);
    removeSerializedNodeIds(legacySnapshot.root);

    expect(serviceA.applyExternalEditorData(legacySnapshot)).toBe(true);
    const firstIds = collectNodeIds((editorA.getDocument('json') as any).root);
    expect(firstIds.length).toBeGreaterThan(0);
    expect(collectNodeIds((editorA.getDocument('json') as any).root)).toEqual(firstIds);

    expect(serviceA.applyExternalEditorData(legacySnapshot)).toBe(false);
    applyUpdate(docB, encodeStateAsUpdate(docA));
    expect(serviceB.applyExternalEditorData(legacySnapshot)).toBe(false);
    expect(collectNodeIds((editorB.getDocument('json') as any).root)).toEqual(firstIds);

    const originalParagraphId = firstIds[0];
    const originalTextId = firstIds[1];
    const mixedSnapshot = structuredClone(legacySnapshot);
    const mixedParagraph = mixedSnapshot.root.children[0];
    mixedParagraph.id = originalParagraphId;
    mixedParagraph.$ = { properties: { nodeId: originalParagraphId } };
    expect(mixedParagraph.children[0].id).toBeUndefined();
    expect(mixedParagraph.children[0].$?.properties?.nodeId).toBeUndefined();

    expect(serviceB.applyExternalEditorData(mixedSnapshot)).toBe(false);
    expect(collectNodeIds((editorB.getDocument('json') as any).root)).toEqual(firstIds);
    expect(serviceA.applyExternalEditorData(mixedSnapshot)).toBe(false);
    expect(collectNodeIds((editorA.getDocument('json') as any).root)).toEqual(firstIds);

    const changedSnapshot = structuredClone(mixedSnapshot);
    const paragraph = changedSnapshot.root.children[0];
    paragraph.$.properties.nodeId = 'explicit-node-id-update';
    paragraph.id = 'explicit-node-id-update';
    expect(serviceB.applyExternalEditorData(changedSnapshot)).toBe(true);
    expect(collectNodeIds((editorB.getDocument('json') as any).root)).toEqual([
      'explicit-node-id-update',
      originalTextId,
    ]);

    const insertedSnapshot = structuredClone(legacySnapshot);
    insertedSnapshot.root.children.unshift({
      children: [
        {
          detail: 0,
          format: 0,
          mode: 'normal',
          style: '',
          text: 'Inserted C',
          type: 'text',
          version: 1,
        },
      ],
      direction: 'ltr',
      format: '',
      indent: 0,
      textFormat: 0,
      textStyle: '',
      type: 'paragraph',
      version: 1,
    });
    expect(serviceA.applyExternalEditorData(insertedSnapshot)).toBe(true);
    const paragraphs = (editorA.getDocument('json') as any).root.children;
    const insertedParagraph = paragraphs[0];
    expect(insertedParagraph.children[0].text).toBe('Inserted C');
    expect(insertedParagraph.$.properties.nodeId).not.toBe(originalParagraphId);
    expect(paragraphs[1].children[0].text).toBe('Legacy snapshot paragraph');

    editorA.destroy();
    editorB.destroy();
  });

  it('applies one AI snapshot across two clients without growing paragraphs or table cells', () => {
    const editorA = createEditor();
    const editorB = createEditor();
    const docA = new Doc();
    const docB = new Doc();
    const providerA = createProvider();
    const providerB = createProvider();
    const bindingA = createBinding(editorA.getLexicalEditor()!, providerA, 'page', docA, new Map());
    const bindingB = createBinding(editorB.getLexicalEditor()!, providerB, 'page', docB, new Map());
    const serviceA = new YjsService();
    const serviceB = new YjsService();
    const ownerTransactions: unknown[] = [];
    const clientBTransactions: unknown[] = [];
    const remoteTransactions: unknown[] = [];

    docA.on('afterTransaction', (transaction) => {
      if (transaction.origin === bindingA) ownerTransactions.push(transaction);
    });
    docB.on('afterTransaction', (transaction) => {
      if (transaction.origin === bindingB) clientBTransactions.push(transaction);
      else remoteTransactions.push(transaction);
    });

    serviceA.setState({
      binding: bindingA,
      doc: docA,
      docMap: new Map(),
      id: 'page',
      provider: providerA,
    });
    serviceB.setState({
      binding: bindingB,
      doc: docB,
      docMap: new Map(),
      id: 'page',
      provider: providerB,
    });

    editorA.setDocument(
      'markdown',
      'Stable paragraph\n\n| A | B | C |\n| --- | --- | --- |\n| 1 | 2 | 3 |\n| 4 | 5 | 6 |',
    );
    const initialSnapshot = editorA.getDocument('json') as unknown as Record<string, unknown>;
    const initialShape = getShape(editorA);

    expect(serviceA.applyExternalEditorData(initialSnapshot)).toBe(true);
    expect(ownerTransactions).toHaveLength(1);
    applyUpdate(docB, encodeStateAsUpdate(docA));
    expect(remoteTransactions).toHaveLength(1);
    expect(serviceB.applyExternalEditorData(initialSnapshot)).toBe(false);
    expect(getShape(editorB)).toEqual(initialShape);

    const aiSnapshot = structuredClone(initialSnapshot) as any;
    aiSnapshot.root.children[0].children[0].text = 'Stable paragraph edited once';

    ownerTransactions.length = 0;
    expect(serviceA.applyExternalEditorData(aiSnapshot)).toBe(true);
    expect(ownerTransactions).toHaveLength(1);
    remoteTransactions.length = 0;
    applyUpdate(docB, encodeStateAsUpdate(docA));
    expect(remoteTransactions).toHaveLength(1);
    // A client may receive the Yjs update and the server result in either
    // order. The first call replaces its stale local binding exactly once;
    // repeating the same result is an idempotent no-op.
    expect(serviceB.applyExternalEditorData(aiSnapshot)).toBe(true);
    expect(clientBTransactions).toHaveLength(1);
    expect(serviceB.applyExternalEditorData(aiSnapshot)).toBe(false);
    expect(clientBTransactions).toHaveLength(1);

    expect(getShape(editorA)).toEqual(initialShape);
    expect(getShape(editorB)).toEqual(initialShape);
    expect(editorA.getDocument('text')).toContain('edited once');
    expect(editorB.getDocument('text')).toContain('edited once');
  });
});
