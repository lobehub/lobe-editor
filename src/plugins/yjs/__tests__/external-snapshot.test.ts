import { createBinding, type Provider } from '@lexical/yjs';
import { applyUpdate, Doc, encodeStateAsUpdate } from 'yjs';

import { Kernel } from '@/editor-kernel/kernel';
import { CommonPlugin } from '@/plugins/common';
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
