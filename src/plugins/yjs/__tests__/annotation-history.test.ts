import type { Provider } from '@lexical/yjs';
import {
  $createRangeSelection,
  $getRoot,
  $setSelection,
  REDO_COMMAND,
  UNDO_COMMAND,
} from 'lexical';
import { applyUpdate, Doc } from 'yjs';
import { describe, expect, it } from 'vitest';

import { Kernel } from '@/editor-kernel/kernel';
import { CommonPlugin } from '@/plugins/common';
import { MarkdownPlugin } from '@/plugins/markdown';
import {
  $findNodeById,
  $getNodeId,
  $getNodeProperties,
  CREATE_ANNOTATION_COMMAND,
  IAnnotationService,
  PropertiesPlugin,
} from '@/plugins/properties';

import { YjsPlugin } from '../plugin';

type TestProvider = Provider & { emitSync: () => void };

const createProvider = (): TestProvider => {
  const listeners = new Map<string, Set<(value?: boolean) => void>>();
  const on = (type: string, listener: (value?: boolean) => void) => {
    const registered = listeners.get(type) ?? new Set();
    registered.add(listener);
    listeners.set(type, registered);
  };
  const off = (type: string, listener: (value?: boolean) => void) => {
    listeners.get(type)?.delete(listener);
  };

  return {
    awareness: {
      getLocalState: () => null,
      getStates: () => new Map(),
      off,
      on,
      setLocalState: () => undefined,
      setLocalStateField: () => undefined,
    },
    connect: () => undefined,
    disconnect: () => undefined,
    emitSync: () => listeners.get('sync')?.forEach((listener) => listener(true)),
    off,
    on,
  } as unknown as TestProvider;
};

const connectDocs = (
  left: Doc,
  leftProvider: TestProvider,
  right: Doc,
  rightProvider: TestProvider,
): void => {
  left.on('update', (update, origin) => {
    if (origin === rightProvider) return;
    applyUpdate(right, update, leftProvider);
  });
  right.on('update', (update, origin) => {
    if (origin === leftProvider) return;
    applyUpdate(left, update, rightProvider);
  });
};

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

const createYjsEditor = (doc: Doc, provider: TestProvider) => {
  const kernel = new Kernel();
  kernel.registerPlugins([
    [CommonPlugin, { enableHotkey: false }],
    MarkdownPlugin,
    PropertiesPlugin,
    [
      YjsPlugin,
      {
        id: 'annotation-history',
        providerFactory: () => provider,
        yjsDoc: doc,
      },
    ],
  ]);
  kernel.initHeadlessEditor();
  return kernel;
};

const annotationIds = (kernel: Kernel): string[] => {
  const editor = kernel.getLexicalEditor()!;
  return editor.getEditorState().read(() =>
    $getRoot()
      .getAllTextNodes()
      .flatMap((node) => $getNodeProperties(node).annotationIds ?? []),
  );
};

const textContent = (kernel: Kernel): string =>
  kernel
    .getLexicalEditor()!
    .getEditorState()
    .read(() => $getRoot().getTextContent());

describe('Yjs + annotation history', () => {
  it('propagates annotation state to a peer and clears/restores it with undo/redo', async () => {
    const docA = new Doc();
    const docB = new Doc();
    const providerA = createProvider();
    const providerB = createProvider();
    connectDocs(docA, providerA, docB, providerB);
    const kernelA = createYjsEditor(docA, providerA);

    kernelA.setDocument('markdown', 'Shared text');
    providerA.emitSync();
    await flush();

    const kernelB = createYjsEditor(docB, providerB);
    providerB.emitSync();
    await flush();
    expect(textContent(kernelA)).toBe('Shared text');
    expect(textContent(kernelB)).toBe('Shared text');

    const paragraphId = kernelA.getLexicalEditor()!.getEditorState().read(() => {
      const paragraph = $getRoot().getFirstChild();
      return paragraph ? $getNodeId(paragraph) : undefined;
    });
    expect(paragraphId).toBeTruthy();
    kernelB.getLexicalEditor()!.getEditorState().read(() => {
      expect($findNodeById(paragraphId!)).not.toBeNull();
    });

    const editorA = kernelA.getLexicalEditor()!;
    editorA.update(() => {
      const text = $getRoot().getAllTextNodes()[0];
      const selection = $createRangeSelection();
      selection.anchor.set(text.getKey(), 0, 'text');
      selection.focus.set(text.getKey(), 6, 'text');
      $setSelection(selection);
      editorA.dispatchCommand(CREATE_ANNOTATION_COMMAND, {
        id: 'peer-comment',
        payload: { text: 'peer' },
      });
    });
    await flush();
    await flush();

    expect(annotationIds(kernelA)).toContain('peer-comment');
    expect(annotationIds(kernelB)).toContain('peer-comment');
    expect(textContent(kernelB)).toBe('Shared text');
    expect(kernelA.requireService(IAnnotationService)?.get('peer-comment')?.status).toBe('active');
    expect(kernelB.requireService(IAnnotationService)?.get('peer-comment')?.status).toBe('active');

    editorA.dispatchCommand(UNDO_COMMAND, undefined);
    await flush();
    await flush();

    expect(textContent(kernelA)).toBe('Shared text');
    expect(textContent(kernelB)).toBe('Shared text');
    expect(annotationIds(kernelA)).not.toContain('peer-comment');
    expect(annotationIds(kernelB)).not.toContain('peer-comment');
    expect(kernelA.requireService(IAnnotationService)?.get('peer-comment')).toMatchObject({
      status: 'orphaned',
      nodeKeys: [],
    });
    expect(kernelB.requireService(IAnnotationService)?.get('peer-comment')).toMatchObject({
      status: 'orphaned',
      nodeKeys: [],
    });

    editorA.dispatchCommand(REDO_COMMAND, undefined);
    await flush();
    await flush();

    expect(annotationIds(kernelA)).toContain('peer-comment');
    expect(annotationIds(kernelB)).toContain('peer-comment');
    expect(kernelA.requireService(IAnnotationService)?.get('peer-comment')?.status).toBe('active');
    expect(kernelB.requireService(IAnnotationService)?.get('peer-comment')?.status).toBe('active');

    kernelA.destroy();
    kernelB.destroy();
    docA.destroy();
    docB.destroy();
  });

  it('keeps ordinary text undo independent from annotation state', async () => {
    const doc = new Doc();
    const provider = createProvider();
    const kernel = createYjsEditor(doc, provider);
    kernel.setDocument('markdown', 'Text');
    provider.emitSync();
    await flush();
    await new Promise((resolve) => setTimeout(resolve, 600));

    const editor = kernel.getLexicalEditor()!;
    editor.update(() => {
      $getRoot().getAllTextNodes()[0].setTextContent('Text edited');
    });
    await flush();
    await new Promise((resolve) => setTimeout(resolve, 600));
    editor.update(() => {
      $getRoot().getAllTextNodes()[0].setTextContent('Text edited twice');
    });
    await flush();

    editor.dispatchCommand(UNDO_COMMAND, undefined);
    await flush();
    expect(textContent(kernel)).toBe('Text edited');

    kernel.destroy();
    doc.destroy();
  });
});
