import { createBinding, type Provider, syncLexicalUpdateToYjs } from '@lexical/yjs';
import { $createParagraphNode, $createTextNode, $getRoot } from 'lexical';
import { Doc } from 'yjs';
import { describe, expect, it } from 'vitest';

import { Kernel } from '@/editor-kernel/kernel';
import { CommonPlugin } from '@/plugins/common';
import { PropertiesPlugin, $getNodeProperties, $setNodeProperties } from '@/plugins/properties';

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

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

describe('Yjs NodeState annotation bridge', () => {
  it('writes annotation NodeState into the shared text map', async () => {
    const kernel = new Kernel();
    kernel.registerPlugins([CommonPlugin, PropertiesPlugin]);
    kernel.initHeadlessEditor();
    const editor = kernel.getLexicalEditor()!;
    const provider = createProvider();
    const doc = new Doc();
    const binding = createBinding(editor, provider, 'state', doc, new Map());
    const unregisterSync = editor.registerUpdateListener(
      ({ dirtyElements, dirtyLeaves, editorState, normalizedNodes, prevEditorState, tags }) => {
        syncLexicalUpdateToYjs(
          binding,
          provider,
          prevEditorState,
          editorState,
          dirtyElements,
          dirtyLeaves,
          normalizedNodes,
          tags,
        );
      },
    );

    editor.update(() => {
      const paragraph = $createParagraphNode();
      paragraph.append($createTextNode('state'));
      $getRoot().append(paragraph);
    });
    await flush();

    editor.update(() => {
      const text = $getRoot().getAllTextNodes()[0];
      $setNodeProperties(text, { annotationIds: ['state-comment'] });
    });
    await flush();

    const paragraph = binding.root.getSharedType().toDelta()[0]?.insert as any;
    const textMap = paragraph?.toDelta?.()[0]?.insert as any;
    expect(textMap?.get?.('__state')?.toJSON?.()).toMatchObject({
      properties: { annotationIds: ['state-comment'] },
    });

    unregisterSync();
    kernel.destroy();
    doc.destroy();
  });
});
