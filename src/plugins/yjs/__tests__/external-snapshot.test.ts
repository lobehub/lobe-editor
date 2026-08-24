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

describe('YjsService external snapshots', () => {
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
