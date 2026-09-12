import { createBinding, type Provider } from '@lexical/yjs';
import { $getRoot, $nodesOfType } from 'lexical';
import { describe, expect, it } from 'vitest';
import { applyUpdate, Doc, encodeStateAsUpdate, XmlText } from 'yjs';

import { Kernel } from '@/editor-kernel/kernel';
import { CommonPlugin } from '@/plugins/common';
import { HoleNode } from '@/plugins/common/node/hole';
import type { HoleNormalizationGuard } from '@/plugins/common/node/hole-normalization';
import { IHoleService } from '@/plugins/common/service/i-hole-service';
import { PropertiesPlugin } from '@/plugins/properties/plugin';
import { type YjsInitialEditorState, YjsPlugin } from '@/plugins/yjs/plugin';
import { syncCurrentEditorStateToYjs } from '@/plugins/yjs/plugin/utils/sync';

import { $createBlockImageNode, BlockImageNode } from '../node/block-image-node';
import { ImagePlugin } from '../plugin';

type TestProvider = Provider & { emitSync: () => void };
type InitialEditorState = YjsInitialEditorState;

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

const createYjsEditor = (
  doc: Doc,
  provider: TestProvider,
  normalizationGuard?: HoleNormalizationGuard,
  initialEditorState?: InitialEditorState,
): Kernel => {
  const kernel = new Kernel();
  kernel.registerPlugins([
    [CommonPlugin, { enableHotkey: false }],
    PropertiesPlugin,
    ImagePlugin,
    [
      YjsPlugin,
      {
        id: 'block-image-migration',
        initialEditorState,
        providerFactory: () => provider,
        yjsDoc: doc,
      },
    ],
  ]);
  kernel.initHeadlessEditor();
  if (normalizationGuard)
    kernel.requireService(IHoleService)?.setNormalizationGuard(normalizationGuard);
  return kernel;
};

const legacyImage = {
  altText: '旧图',
  height: 90,
  maxWidth: 600,
  src: 'https://cdn.example.com/legacy.png',
  status: 'uploaded',
  type: 'block-image',
  version: 1,
  width: 160,
};

const summary = (kernel: Kernel) =>
  kernel
    .getLexicalEditor()!
    .getEditorState()
    .read(() => ({
      blockImageCount: $nodesOfType(BlockImageNode).length,
      holeCount: $nodesOfType(HoleNode).length,
      rootTypes: $getRoot()
        .getChildren()
        .map((node) => node.getType()),
    }));

type SharedNodeLike = {
  getAttribute?: (name: string) => unknown;
  toArray?: () => unknown[];
  toDelta?: () => Array<{ insert?: unknown }>;
};

const readYjsRootTypes = (doc: Doc): string[] =>
  doc
    .get('root', XmlText)
    .toDelta()
    .flatMap(({ insert }: { insert?: unknown }) => {
      if (!insert || typeof insert === 'string') return [];
      const type = (insert as SharedNodeLike).getAttribute?.('__type');
      return typeof type === 'string' ? [type] : [];
    });

const hasSharedType = (doc: Doc, type: string): boolean => {
  const visited = new Set<object>();
  let found = false;
  const visit = (value: unknown): void => {
    if (found || !value || typeof value !== 'object' || visited.has(value)) return;
    visited.add(value);
    const node = value as SharedNodeLike;
    if (node.getAttribute?.('__type') === type) {
      found = true;
      return;
    }
    node.toDelta?.().forEach(({ insert }) => visit(insert));
    node.toArray?.().forEach(visit);
  };

  doc
    .get('root', XmlText)
    .toDelta()
    .forEach(({ insert }: { insert?: unknown }) => visit(insert));
  return found;
};

const observeFirstSharedImage = (doc: Doc, action: () => void): string[][] => {
  const mirror = new Doc();
  applyUpdate(mirror, encodeStateAsUpdate(doc));
  const rootTypesWhenImageExists: string[][] = [];
  const onUpdate = (update: Uint8Array) => {
    applyUpdate(mirror, update);
    if (hasSharedType(mirror, 'block-image')) {
      rootTypesWhenImageExists.push(readYjsRootTypes(mirror));
    }
  };

  doc.on('update', onUpdate);
  try {
    action();
  } finally {
    doc.off('update', onUpdate);
    mirror.destroy();
  }
  return rootTypesWhenImageExists;
};

const expectImagesWereHoleWrappedFromFirstUpdate = (rootTypes: string[][]): void => {
  expect(rootTypes.length).toBeGreaterThan(0);
  rootTypes.forEach((types) => {
    expect(types).toContain('hole');
    expect(types).not.toContain('block-image');
  });
};

describe('BlockImage Hole migration with Yjs', () => {
  it('wraps a local block image before its first shared update when the provider is already ready', async () => {
    const doc = new Doc();
    const provider = createProvider();
    const kernel = createYjsEditor(doc, provider);
    provider.emitSync();
    await flush();

    const firstSharedRootTypes = observeFirstSharedImage(doc, () => {
      kernel.setDocument('json', {
        root: { children: [legacyImage], type: 'root', version: 1 },
      });
    });
    await flush();
    await flush();

    expect(summary(kernel)).toEqual({ blockImageCount: 1, holeCount: 1, rootTypes: ['hole'] });
    expectImagesWereHoleWrappedFromFirstUpdate(firstSharedRootTypes);
    expect(
      doc
        .get('root', XmlText)
        .toDelta()
        .map((delta: { insert?: unknown }) =>
          typeof delta.insert === 'string'
            ? 'text'
            : (delta.insert as { getAttribute?: (key: string) => unknown })?.getAttribute?.(
                '__type',
              ),
        ),
    ).toEqual(['hole']);

    kernel.destroy();
    doc.destroy();
  });

  it('wraps an initial editor state before its first shared update', async () => {
    const doc = new Doc();
    const provider = createProvider();
    const kernel = createYjsEditor(doc, provider, undefined, () => {
      $getRoot().append(
        $createBlockImageNode({
          altText: legacyImage.altText,
          height: legacyImage.height,
          maxWidth: legacyImage.maxWidth,
          src: legacyImage.src,
          width: legacyImage.width,
        }),
      );
    });

    const firstSharedRootTypes = observeFirstSharedImage(doc, () => provider.emitSync());
    await flush();

    expect(summary(kernel)).toEqual({ blockImageCount: 1, holeCount: 1, rootTypes: ['hole'] });
    expectImagesWereHoleWrappedFromFirstUpdate(firstSharedRootTypes);

    kernel.destroy();
    doc.destroy();
  });

  it('normalizes a JSON replacement before publishing into a populated shared room', async () => {
    const doc = new Doc();
    const provider = createProvider();
    const kernel = createYjsEditor(doc, provider);
    provider.emitSync();
    await flush();

    kernel.setDocument('json', {
      root: {
        children: [
          {
            children: [{ text: '保留段落', type: 'text', version: 1 }],
            direction: null,
            format: '',
            indent: 0,
            type: 'paragraph',
            version: 1,
          },
        ],
        type: 'root',
        version: 1,
      },
    });
    await flush();

    kernel.requireService(IHoleService)?.setNormalizationGuard(() => false);
    const firstReplacementRootTypes = observeFirstSharedImage(doc, () => {
      kernel.setDocument(
        'json',
        {
          root: { children: [legacyImage], type: 'root', version: 1 },
        },
        { keepId: true },
      );
    });
    await flush();
    await flush();

    expect(summary(kernel)).toEqual({ blockImageCount: 1, holeCount: 1, rootTypes: ['hole'] });
    expectImagesWereHoleWrappedFromFirstUpdate(firstReplacementRootTypes);

    kernel.destroy();
    doc.destroy();
  });

  it('converges old bare BlockImage JSON to one Hole on both peers without echo', async () => {
    const legacyKernel = new Kernel();
    legacyKernel.registerPlugins([[CommonPlugin, { enableHotkey: false }]]);
    legacyKernel.registerNodes([BlockImageNode]);
    legacyKernel.initHeadlessEditor();
    legacyKernel.setDocument('json', {
      root: { children: [legacyImage], type: 'root', version: 1 },
    });
    const legacyDoc = new Doc();
    const legacyProvider = createProvider();
    const legacyBinding = createBinding(
      legacyKernel.getLexicalEditor()!,
      legacyProvider,
      'block-image-migration',
      legacyDoc,
      new Map([['block-image-migration', legacyDoc]]),
    );
    syncCurrentEditorStateToYjs(legacyBinding, legacyProvider);
    const legacySnapshot = encodeStateAsUpdate(legacyDoc);
    legacyBinding.root.destroy(legacyBinding);
    legacyKernel.destroy();
    legacyDoc.destroy();

    const docA = new Doc();
    const docB = new Doc();
    applyUpdate(docA, legacySnapshot);
    applyUpdate(docB, legacySnapshot);
    const providerA = createProvider();
    const providerB = createProvider();
    let updateCount = 0;
    docA.on('update', () => updateCount++);
    docB.on('update', () => updateCount++);
    connectDocs(docA, providerA, docB, providerB);

    const kernelA = createYjsEditor(docA, providerA, () => true);
    const kernelB = createYjsEditor(docB, providerB, () => false);
    kernelA.setDocument('json', {
      root: { children: [legacyImage], type: 'root', version: 1 },
    });
    kernelB.setDocument('json', {
      root: { children: [legacyImage], type: 'root', version: 1 },
    });
    providerB.emitSync();
    providerA.emitSync();
    await flush();
    await flush();
    await flush();

    expect(summary(kernelA)).toEqual({ blockImageCount: 1, holeCount: 1, rootTypes: ['hole'] });
    expect(summary(kernelB)).toEqual({ blockImageCount: 1, holeCount: 1, rootTypes: ['hole'] });

    const countAfterInitialSync = updateCount;
    kernelA.setDocument(
      'json',
      {
        root: { children: [legacyImage], type: 'root', version: 1 },
      },
      { keepId: true },
    );
    providerA.emitSync();
    await flush();
    await flush();
    await flush();

    expect(summary(kernelA)).toEqual({ blockImageCount: 1, holeCount: 1, rootTypes: ['hole'] });
    expect(summary(kernelB)).toEqual({ blockImageCount: 1, holeCount: 1, rootTypes: ['hole'] });
    const countAfterRehydrate = updateCount;
    expect(countAfterRehydrate - countAfterInitialSync).toBeLessThan(8);
    await flush();
    await flush();
    expect(updateCount).toBe(countAfterRehydrate);

    kernelA.destroy();
    kernelB.destroy();
    docA.destroy();
    docB.destroy();
  });
});
