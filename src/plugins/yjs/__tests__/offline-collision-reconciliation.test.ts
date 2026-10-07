import type { Provider, ProviderAwareness, UserState } from '@lexical/yjs';
import {
  $getRoot,
  $isElementNode,
  $isTextNode,
  COLLABORATION_TAG,
  HISTORIC_TAG,
  REDO_COMMAND,
  UNDO_COMMAND,
} from 'lexical';
import { applyUpdate, Doc, encodeStateAsUpdate, encodeStateVector, Map as YMap } from 'yjs';

import { Kernel } from '@/editor-kernel/kernel';
import { CommonPlugin } from '@/plugins/common/plugin';
import { IYjsService } from '@/plugins/yjs/service';
import { YjsPlugin } from '@/plugins/yjs/plugin';

class OfflineProvider implements Provider {
  awareness: ProviderAwareness = {
    getLocalState: () => null,
    getStates: () => new Map<number, UserState>(),
    on: () => undefined,
    off: () => undefined,
    setLocalState: () => undefined,
    setLocalStateField: () => undefined,
  };
  listeners = {
    sync: new Set<(value: boolean) => void>(),
    status: new Set<(value: { status: string }) => void>(),
    update: new Set<(value: unknown) => void>(),
    reload: new Set<(value: Doc) => void>(),
  };
  constructor(readonly doc: Doc) {}
  connect() {}
  disconnect() {}
  on(type: 'sync' | 'status' | 'update' | 'reload', listener: any) {
    this.listeners[type].add(listener);
  }
  off(type: 'sync' | 'status' | 'update' | 'reload', listener: any) {
    this.listeners[type].delete(listener);
  }
  emitSync(value: boolean) {
    this.listeners.sync.forEach((listener) => listener(value));
  }
}

type Client = {
  content: string;
  doc: Doc;
  editor: Kernel;
  provider: OfflineProvider;
  updates: number;
};
type ContentIdentity = { content: string; paragraphId: string; textIds: string[] };
const collect = (node: any, out: any[] = []): any[] => {
  if (node?.type && node.type !== 'root')
    out.push({ type: node.type, text: node.text, id: node.$?.properties?.nodeId });
  node?.children?.forEach((child: any) => collect(child, out));
  return out;
};
const byContent = (editor: Kernel): ContentIdentity[] => {
  const root = (editor.getDocument('json') as any).root;
  return root.children
    .map((paragraph: any) => ({
      content: paragraph.children.map((child: any) => child.text || '').join(''),
      paragraphId: paragraph.$?.properties?.nodeId,
      textIds: paragraph.children.map((child: any) => child.$?.properties?.nodeId),
    }))
    .sort((a: any, b: any) => a.content.localeCompare(b.content));
};
const sharedIds = (editor: Kernel): string[] => {
  const service = editor.requireService(IYjsService);
  const binding = service?.getState()?.binding;
  if (!binding) throw new Error('Expected a live Yjs binding.');

  return [...binding.collabNodeMap.values()]
    .map((collabNode) => collabNode.getSharedType())
    .map((sharedType) => {
      const state =
        sharedType instanceof YMap ? sharedType.get('__state') : sharedType.getAttribute('__state');
      return state instanceof YMap
        ? (state.get('properties') as { nodeId?: string } | undefined)
        : undefined;
    })
    .map((properties) => properties?.nodeId)
    .filter((nodeId): nodeId is string => typeof nodeId === 'string');
};
const makeState = (content: string) => ({
  root: {
    children: [
      {
        children: [
          {
            detail: 0,
            format: 0,
            mode: 'normal',
            style: '',
            text: content,
            type: 'text',
            version: 1,
            $: { properties: { nodeId: 'shared-txt' } },
          },
        ],
        direction: 'ltr',
        format: '',
        indent: 0,
        type: 'paragraph',
        version: 1,
        $: { properties: { nodeId: 'shared-p' } },
      },
    ],
    direction: null,
    format: '',
    indent: 0,
    type: 'root',
    version: 1,
  },
});
const tick = () => new Promise((resolve) => setTimeout(resolve, 0));
const stateVector = (doc: Doc) => Buffer.from(encodeStateVector(doc)).toString('hex');
async function pumpToFixedPoint(clients: Client[], order: number[]) {
  const rounds: Array<{ vectors: string[]; updates: number[] }> = [];
  for (let round = 0; round < 12; round++) {
    const before = clients.map(({ doc, updates }) => ({ vector: stateVector(doc), updates }));
    const snapshots = clients.map(({ doc }) => encodeStateAsUpdate(doc));
    for (const source of order) {
      for (const target of order) {
        if (source !== target)
          applyUpdate(clients[target].doc, snapshots[source], clients[source].provider);
      }
    }
    await tick();
    const vectors = clients.map(({ doc }) => stateVector(doc));
    const updates = clients.map(({ updates }) => updates);
    rounds.push({ vectors, updates });
    if (
      new Set(vectors).size === 1 &&
      clients.every((client, index) => client.updates === before[index].updates)
    )
      return rounds;
  }
  throw new Error(`Yjs exchange did not settle: ${JSON.stringify(rounds)}`);
}

describe('YjsPlugin offline node ID reconciliation', () => {
  it.each([
    { name: 'forward peer order', order: [0, 1, 2] },
    { name: 'reverse peer order', order: [2, 1, 0] },
  ])(
    'merges unique offline imports and reaches a stable fixed point ($name)',
    async ({ order }) => {
      const clients: Client[] = [];
      let lateEditor: Kernel | undefined;
      try {
        for (const content of ['Alpha', 'Beta', 'Gamma']) {
          const editor = new Kernel();
          const doc = new Doc();
          const clientIds: Record<string, number> = { Alpha: 3001, Beta: 1001, Gamma: 2001 };
          doc.clientID = clientIds[content];
          const provider = new OfflineProvider(doc);
          editor.registerPlugins([
            CommonPlugin,
            [YjsPlugin, { id: 'offline-room', yjsDoc: doc, providerFactory: () => provider }],
          ]);
          editor.setRootElement(document.createElement('div'));
          provider.emitSync(true); // private offline cache is ready; no peers are connected
          doc.on('update', () => {
            const client = clients.find((entry) => entry.doc === doc);
            if (client) client.updates++;
          });
          const client = { content, doc, editor, provider, updates: 0 };
          clients.push(client);
          editor.setDocument('json', makeState(content), { keepId: true });
          await tick();
        }
        const before = clients.map(({ editor }) =>
          collect((editor.getDocument('json') as any).root),
        );
        expect(before.map((tree) => tree.map((node) => node.id))).toEqual([
          ['shared-p', 'shared-txt'],
          ['shared-p', 'shared-txt'],
          ['shared-p', 'shared-txt'],
        ]);
        expect(before.map((tree) => tree.map((node) => node.text).filter(Boolean))).toEqual([
          ['Alpha'],
          ['Beta'],
          ['Gamma'],
        ]);

        const lateDoc = new Doc();
        lateDoc.clientID = 4001;
        order
          .slice(0, 2)
          .forEach((source) =>
            applyUpdate(
              lateDoc,
              encodeStateAsUpdate(clients[source].doc),
              clients[source].provider,
            ),
          );
        const lateProvider = new OfflineProvider(lateDoc);
        lateEditor = new Kernel();
        lateEditor.registerPlugins([
          CommonPlugin,
          [YjsPlugin, { id: 'offline-room', yjsDoc: lateDoc, providerFactory: () => lateProvider }],
        ]);
        lateEditor.setRootElement(document.createElement('div'));
        lateProvider.emitSync(true);
        await tick();
        const lateMappings = byContent(lateEditor);
        expect(lateMappings.map((item) => item.content)).toEqual(
          order
            .slice(0, 2)
            .map((index) => clients[index].content)
            .sort(),
        );
        expect(
          new Set(lateMappings.flatMap((item) => [item.paragraphId, ...item.textIds])).size,
        ).toBe(4);
        expect(sharedIds(lateEditor).sort()).toEqual(
          collect((lateEditor.getDocument('json') as any).root)
            .map((node) => node.id)
            .sort(),
        );

        await pumpToFixedPoint(clients, order);
        const mappings = clients.map(({ editor }) => byContent(editor));
        expect(mappings[1]).toEqual(mappings[0]);
        expect(mappings[2]).toEqual(mappings[0]);
        expect(mappings[0].map((item) => item.content)).toEqual(['Alpha', 'Beta', 'Gamma']);
        expect(new Set(mappings[0].map((item) => item.paragraphId)).size).toBe(3);
        expect(new Set(mappings[0].flatMap((item) => item.textIds)).size).toBe(3);
        const allIds = mappings[0].flatMap((item) => [item.paragraphId, ...item.textIds]);
        expect(new Set(allIds).size).toBe(6);
        expect(mappings[0].find((item) => item.content === 'Beta')?.paragraphId).toBe('shared-p');
        expect(mappings[0].find((item) => item.content === 'Beta')?.textIds).toEqual([
          'shared-txt',
        ]);
        expect(
          mappings[0].every(
            (item) => /^[0-9a-z]{10}$/.test(item.paragraphId) || item.paragraphId === 'shared-p',
          ),
        ).toBe(true);
        expect(
          mappings[0].every((item) =>
            item.textIds.every((id: string) => /^[0-9a-z]{10}$/.test(id) || id === 'shared-txt'),
          ),
        ).toBe(true);
        for (const client of clients) {
          const lexicalIds = collect((client.editor.getDocument('json') as any).root)
            .map((node) => node.id)
            .sort();
          expect(sharedIds(client.editor).sort()).toEqual(lexicalIds);
        }

        // Trigger a normal local editor update after remote merge, which runs the
        // root identity normalizer against a stable, unique shared-ID set.
        await new Promise((resolve) => setTimeout(resolve, 650));
        const replacedContent = clients[0].editor
          .getLexicalEditor()!
          .getEditorState()
          .read(() => {
            const paragraph = $getRoot().getFirstChild();
            return $isElementNode(paragraph) ? paragraph.getTextContent() : '';
          });
        const lexicalEditor = clients[0].editor.getLexicalEditor()!;
        let localEditTags: string[] = [];
        const unregisterUpdateListener = lexicalEditor.registerUpdateListener(
          ({ dirtyLeaves, tags }) => {
            if (dirtyLeaves.size > 0) localEditTags = Array.from(tags);
          },
        );
        lexicalEditor.update(
          () => {
            const paragraph = $getRoot().getFirstChild();
            if (!$isElementNode(paragraph)) return;
            const text = paragraph.getFirstChild();
            if ($isTextNode(text)) text.setTextContent('Gamma edited');
          },
          { discrete: true },
        );
        await tick();
        unregisterUpdateListener();
        expect(localEditTags).not.toContain(COLLABORATION_TAG);
        expect(localEditTags).not.toContain(HISTORIC_TAG);
        await pumpToFixedPoint(clients, order);
        const repaired = clients.map(({ editor }) => byContent(editor));
        expect(repaired[1]).toEqual(repaired[0]);
        expect(repaired[2]).toEqual(repaired[0]);
        const expectedAfterEdit = ['Alpha', 'Beta', 'Gamma']
          .filter((content) => content !== replacedContent)
          .concat('Gamma edited')
          .sort();
        expect(repaired[0].map((item) => item.content)).toEqual(expectedAfterEdit);
        expect(new Set(repaired[0].map((item) => item.paragraphId)).size).toBe(3);
        expect(new Set(repaired[0].flatMap((item) => item.textIds)).size).toBe(3);

        clients[0].editor.getLexicalEditor()!.dispatchCommand(UNDO_COMMAND, undefined);
        await tick();
        await pumpToFixedPoint(clients, order);
        const afterUndo = clients.map(({ editor }) => byContent(editor));
        expect(afterUndo[1]).toEqual(afterUndo[0]);
        expect(afterUndo[2]).toEqual(afterUndo[0]);
        expect(afterUndo[0].map((item) => item.content).sort()).toEqual(['Alpha', 'Beta', 'Gamma']);
        expect(afterUndo[0].map((item) => [item.paragraphId, ...item.textIds])).toEqual(
          mappings[0].map((item) => [item.paragraphId, ...item.textIds]),
        );

        clients[0].editor.getLexicalEditor()!.dispatchCommand(REDO_COMMAND, undefined);
        await tick();
        await pumpToFixedPoint(clients, order);
        const afterRedo = clients.map(({ editor }) => byContent(editor));
        expect(afterRedo[1]).toEqual(afterRedo[0]);
        expect(afterRedo[2]).toEqual(afterRedo[0]);
        expect(afterRedo[0]).toEqual(repaired[0]);

        const stableUpdates = clients.map(({ updates }) => updates);
        const stableVectors = clients.map(({ doc }) => stateVector(doc));
        await pumpToFixedPoint(clients, [...order].reverse());
        await pumpToFixedPoint(clients, order);
        expect(clients.map(({ doc }) => stateVector(doc))).toEqual(stableVectors);
        expect(clients.map(({ updates }) => updates)).toEqual(stableUpdates);
        expect(clients.map(({ editor }) => byContent(editor))).toEqual(afterRedo);
      } finally {
        lateEditor?.destroy();
        clients.forEach(({ editor }) => editor.destroy());
      }
    },
  );
});
