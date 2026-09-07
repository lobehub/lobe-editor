import { createBinding, type Provider, type ProviderAwareness } from '@lexical/yjs';
import { $createParagraphNode, $createTextNode, $getRoot, ElementNode } from 'lexical';
import { $createQuoteNode } from '@lexical/rich-text';
import { afterEach, describe, expect, it } from 'vitest';
import { applyUpdate, Doc, encodeStateAsUpdate } from 'yjs';

import Editor, { moment } from '@/editor-kernel';
import { DEFAULT_HEADLESS_EDITOR_PLUGINS } from '@/headless/default-plugins';
import { $createHoleNode } from '@/plugins/common/node/hole';
import {
  hydrateLexicalFromYjsState,
  syncCurrentEditorStateToYjs,
} from '@/plugins/yjs/plugin/utils/sync';

class NoopProvider implements Provider {
  readonly awareness: ProviderAwareness = {
    getLocalState: () => null,
    getStates: () => new Map(),
    off: () => undefined,
    on: () => undefined,
    setLocalState: () => undefined,
    setLocalStateField: () => undefined,
  };

  connect(): void {}
  disconnect(): void {}
  off(): void {}
  on(): void {}
}

const settle = async (): Promise<void> => {
  await moment();
  await Promise.resolve();
  await moment();
};

const createKernel = (dom = false) => {
  const kernel = Editor.createEditor().registerPlugins([...DEFAULT_HEADLESS_EDITOR_PLUGINS]);
  const root = dom ? document.createElement('div') : null;
  if (root) document.body.append(root);
  const editor = root ? kernel.setRootElement(root) : kernel.initHeadlessEditor();
  if (!editor) throw new Error('Expected a headless Lexical editor.');
  return { editor, kernel, root };
};

const createNestedHoleSnapshot = async (): Promise<Doc> => {
  const { editor, kernel } = createKernel();
  const sourceDoc = new Doc();
  const provider = new NoopProvider();
  const binding = createBinding(
    editor,
    provider,
    'hydration-room',
    sourceDoc,
    new Map([['hydration-room', sourceDoc]]),
  );

  editor.update(() => {
    const hole = $createHoleNode($createTextNode('nested hole text'));
    const quote = $createQuoteNode().append(hole);
    const before = $createParagraphNode().append($createTextNode('before'));
    const after = $createParagraphNode().append($createTextNode('after'));
    $getRoot().append(before, quote, after);
  });
  await settle();
  syncCurrentEditorStateToYjs(binding, provider);
  binding.root.destroy(binding);
  kernel.destroy();
  return sourceDoc;
};

describe('Yjs hydration root text cache', () => {
  let docs: Doc[] = [];

  afterEach(() => {
    docs.forEach((doc) => doc.destroy());
    docs = [];
  });

  it.each([false, true])(
    'reconciles Hole text under a regular ancestor for discrete=%s without Yjs or undo writes',
    async (discrete) => {
      const sourceDoc = await createNestedHoleSnapshot();
      docs.push(sourceDoc);

      const targetDoc = new Doc();
      docs.push(targetDoc);
      applyUpdate(targetDoc, encodeStateAsUpdate(sourceDoc));
      const target = createKernel(true);
      const provider = new NoopProvider();
      const binding = createBinding(
        target.editor,
        provider,
        'hydration-room',
        targetDoc,
        new Map([['hydration-room', targetDoc]]),
      );
      const updateCount = { value: 0 };
      targetDoc.on('update', () => {
        updateCount.value += 1;
      });
      const undoCount = target.kernel.getHistoryState().undoStack.length;
      try {
        hydrateLexicalFromYjsState(binding, discrete ? { discrete: true } : {});
        await settle();

        const publicText = target.editor.getEditorState().read(() => $getRoot().getTextContent());
        const semanticText = target.editor
          .getEditorState()
          .read(() => ElementNode.prototype.getTextContent.call($getRoot()));
        expect(publicText).toBe(semanticText);
        expect(publicText).toContain('nested hole text');
        expect(updateCount.value).toBe(0);
        expect(target.kernel.getHistoryState().undoStack.length).toBe(undoCount);
      } finally {
        binding.root.destroy(binding);
        target.kernel.destroy();
        target.root?.remove();
      }
    },
  );
});
