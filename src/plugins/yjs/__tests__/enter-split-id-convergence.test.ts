import type { Provider, ProviderAwareness, UserState } from '@lexical/yjs';
import {
  $createRangeSelection,
  $getRoot,
  $isElementNode,
  $isTextNode,
  $setSelection,
  INSERT_PARAGRAPH_COMMAND,
  REDO_COMMAND,
  UNDO_COMMAND,
} from 'lexical';
import { applyUpdate, Doc, encodeStateAsUpdate, encodeStateVector, Map as YMap } from 'yjs';
import { describe, expect, it } from 'vitest';

import { Kernel } from '@/editor-kernel/kernel';
import { CommonPlugin } from '@/plugins/common/plugin';
import { AutoCompletePlugin } from '@/plugins/auto-complete/plugin';
import { MarkdownPlugin } from '@/plugins/markdown';
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
  private listeners = {
    reload: new Set<(doc: Doc) => void>(),
    status: new Set<(value: { status: string }) => void>(),
    sync: new Set<(value: boolean) => void>(),
    update: new Set<(value: unknown) => void>(),
  };

  constructor(readonly doc: Doc) {}

  connect(): void {}
  disconnect(): void {}
  on(type: 'sync' | 'status' | 'update' | 'reload', listener: any): void {
    this.listeners[type].add(listener);
  }
  off(type: 'sync' | 'status' | 'update' | 'reload', listener: any): void {
    this.listeners[type].delete(listener);
  }
  emitSync(synced: boolean): void {
    this.listeners.sync.forEach((listener) => listener(synced));
  }
}

type Client = { doc: Doc; editor: Kernel; provider: OfflineProvider };

const tick = () => new Promise((resolve) => setTimeout(resolve, 0));
const stateVector = (doc: Doc) => Buffer.from(encodeStateVector(doc)).toString('hex');

async function pumpToFixedPoint(clients: Client[]): Promise<void> {
  for (let round = 0; round < 12; round++) {
    const vectorsBefore = clients.map(({ doc }) => stateVector(doc));
    const snapshots = clients.map(({ doc }) => encodeStateAsUpdate(doc));
    for (let source = 0; source < clients.length; source++) {
      for (let target = 0; target < clients.length; target++) {
        if (source !== target) {
          applyUpdate(clients[target].doc, snapshots[source], clients[source].provider);
        }
      }
    }
    await tick();
    const vectorsAfter = clients.map(({ doc }) => stateVector(doc));
    if (
      new Set(vectorsAfter).size === 1 &&
      vectorsAfter.every((value, index) => value === vectorsBefore[index])
    ) {
      return;
    }
  }
  throw new Error('Yjs split updates did not converge.');
}

const createClient = (doc: Doc, suggestion: string | null): Client => {
  const editor = new Kernel();
  const provider = new OfflineProvider(doc);
  editor.registerPlugins([
    CommonPlugin,
    MarkdownPlugin,
    [YjsPlugin, { id: 'enter-split-room', providerFactory: () => provider, yjsDoc: doc }],
    [
      AutoCompletePlugin,
      {
        delay: 10,
        onAutoComplete: async () => suggestion,
      },
    ],
  ]);
  editor.setRootElement(document.createElement('div'));
  provider.emitSync(true);
  return { doc, editor, provider };
};

const createParagraph = (id: string, text: string) => ({
  children: [
    {
      detail: 0,
      format: 0,
      mode: 'normal',
      style: '',
      text,
      type: 'text',
      version: 1,
      $: { properties: { nodeId: `${id}-text` } },
    },
  ],
  direction: 'ltr',
  format: '',
  indent: 0,
  type: 'paragraph',
  version: 1,
  textFormat: 0,
  textStyle: '',
  $: { properties: { nodeId: id } },
});

const initialState = {
  root: {
    children: [
      createParagraph('demo-first-paragraph', 'Hover these links and convert them: '),
      createParagraph('demo-second-paragraph', 'Existing paragraph after the demo intro.'),
      createParagraph(
        'demo-third-paragraph',
        'A later paragraph keeps surrounding blocks present.',
      ),
    ],
    direction: null,
    format: '',
    indent: 0,
    type: 'root',
    version: 1,
  },
};

function insertAtStartAndEnter(editor: Kernel, text: string): void {
  const lexical = editor.getLexicalEditor();
  if (!lexical) throw new Error('Expected an initialized Lexical editor.');

  lexical.update(
    () => {
      const paragraph = $getRoot().getFirstChild();
      if (!$isElementNode(paragraph)) throw new Error('Expected a paragraph at document start.');
      const textNode = paragraph.getFirstChild();
      if (!$isTextNode(textNode)) throw new Error('Expected text at document start.');

      const selection = $createRangeSelection();
      selection.anchor.set(textNode.getKey(), 0, 'text');
      selection.focus.set(textNode.getKey(), 0, 'text');
      $setSelection(selection);
      selection.insertText(text);
    },
    { discrete: true },
  );

  lexical.dispatchCommand(INSERT_PARAGRAPH_COMMAND, undefined);
}

const paragraphs = (editor: Kernel) => {
  const root = (editor.getDocument('json') as any).root;
  return root.children.map((paragraph: any) => ({
    id: paragraph.$?.properties?.nodeId,
    text: paragraph.children.map((child: any) => child.text || '').join(''),
    textIds: paragraph.children
      .filter((child: any) => child.type === 'text')
      .map((child: any) => child.$?.properties?.nodeId),
  }));
};

const collectSynchronizedNodeIds = (node: any): string[] => {
  if (
    !node ||
    node.type === 'PlaceholderInline' ||
    node.type === 'PlaceholderBlock' ||
    node.type === 'cursor'
  ) {
    return [];
  }
  const id = node.$?.properties?.nodeId;
  return [
    ...(typeof id === 'string' ? [id] : []),
    ...(Array.isArray(node.children) ? node.children.flatMap(collectSynchronizedNodeIds) : []),
  ];
};

const sharedNodeIds = (editor: Kernel): string[] => {
  const binding = editor.requireService(IYjsService)?.getState()?.binding;
  if (!binding) throw new Error('Expected a live V1 Yjs binding.');

  return [...binding.collabNodeMap.values()]
    .map((collabNode) => collabNode.getSharedType())
    .map((sharedType) => {
      const state =
        sharedType instanceof YMap ? sharedType.get('__state') : sharedType.getAttribute('__state');
      return state instanceof YMap
        ? (state.get('properties') as { nodeId?: string } | undefined)?.nodeId
        : undefined;
    })
    .filter((id): id is string => typeof id === 'string');
};

const expectSharedIdsMatch = (client: Client): void => {
  const serializedRoot = (client.editor.getDocument('json') as any).root;
  expect(sharedNodeIds(client.editor).sort()).toEqual(
    collectSynchronizedNodeIds(serializedRoot).sort(),
  );
};

describe('Yjs V1 Enter split node identity convergence', () => {
  it('keeps paragraph and text IDs equal after undo/redo and a second client splits at document start', async () => {
    const docA = new Doc();
    docA.clientID = 1001;
    const clientA = createClient(docA, ' This is a local-only suggestion.');
    let clientB: Client | null = null;

    try {
      clientA.editor.setDocument('json', initialState, { keepId: true });
      await tick();
      expect(paragraphs(clientA.editor).map((paragraph: any) => paragraph.text)).toEqual([
        'Hover these links and convert them: ',
        'Existing paragraph after the demo intro.',
        'A later paragraph keeps surrounding blocks present.',
      ]);
      // Separate editor bootstrap from the following user transaction so one
      // undo/redo exercises the text insertion and paragraph split only.
      await new Promise((resolve) => setTimeout(resolve, 650));
      insertAtStartAndEnter(clientA.editor, 'Lexical 0.53 browser check');
      await tick();
      expect(paragraphs(clientA.editor).map((paragraph: any) => paragraph.text)).toEqual([
        'Lexical 0.53 browser check',
        'Hover these links and convert them: ',
        'Existing paragraph after the demo intro.',
        'A later paragraph keeps surrounding blocks present.',
      ]);
      clientA.editor.getLexicalEditor()!.dispatchCommand(UNDO_COMMAND, undefined);
      await tick();
      expect(paragraphs(clientA.editor).map((paragraph: any) => paragraph.text)).toEqual([
        'Hover these links and convert them: ',
        'Existing paragraph after the demo intro.',
        'A later paragraph keeps surrounding blocks present.',
      ]);
      clientA.editor.getLexicalEditor()!.dispatchCommand(REDO_COMMAND, undefined);
      await tick();
      expect(paragraphs(clientA.editor).map((paragraph: any) => paragraph.text)).toEqual([
        'Lexical 0.53 browser check',
        'Hover these links and convert them: ',
        'Existing paragraph after the demo intro.',
        'A later paragraph keeps surrounding blocks present.',
      ]);
      await new Promise((resolve) => setTimeout(resolve, 30));
      const localTypes = (clientA.editor.getDocument('json') as any).root.children.flatMap(
        (node: any) => node.children.map((child: any) => child.type),
      );
      expect(localTypes).toContain('PlaceholderInline');
      expectSharedIdsMatch(clientA);

      const docB = new Doc();
      docB.clientID = 2001;
      applyUpdate(docB, encodeStateAsUpdate(docA), clientA.provider);
      const joinedClient = createClient(docB, null);
      clientB = joinedClient;
      await tick();

      expect(paragraphs(joinedClient.editor)).toEqual(paragraphs(clientA.editor));
      const joinedTypes = (joinedClient.editor.getDocument('json') as any).root.children.flatMap(
        (node: any) => node.children.map((child: any) => child.type),
      );
      expect(joinedTypes).not.toContain('PlaceholderInline');
      insertAtStartAndEnter(joinedClient.editor, 'Second client sync check');
      await tick();
      await pumpToFixedPoint([clientA, joinedClient]);

      const firstState = paragraphs(clientA.editor);
      const secondState = paragraphs(joinedClient.editor);
      expect(firstState.map((paragraph: any) => paragraph.text)).toEqual([
        'Second client sync check',
        'Lexical 0.53 browser check',
        'Hover these links and convert them: ',
        'Existing paragraph after the demo intro.',
        'A later paragraph keeps surrounding blocks present.',
      ]);
      expect(secondState).toEqual(firstState);

      for (const state of [firstState, secondState]) {
        const nodeIds = state.flatMap((paragraph: any) => [paragraph.id, ...paragraph.textIds]);
        expect(nodeIds.every((id: unknown) => typeof id === 'string' && id.length > 0)).toBe(true);
        expect(new Set(nodeIds).size).toBe(nodeIds.length);
      }
      expectSharedIdsMatch(clientA);
      expectSharedIdsMatch(joinedClient);

      await pumpToFixedPoint([clientA, joinedClient]);
      expect(paragraphs(clientA.editor)).toEqual(firstState);
      expect(paragraphs(joinedClient.editor)).toEqual(firstState);
    } finally {
      clientA.editor.destroy();
      clientB?.editor.destroy();
    }
  });
});
