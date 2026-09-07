// @vitest-environment node
import type { Provider, ProviderAwareness } from '@lexical/yjs';
import { $getRoot } from 'lexical';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Doc } from 'yjs';

import { Kernel } from '@/editor-kernel/kernel';
import { CommonPlugin } from '@/plugins/common';
import { MarkdownPlugin } from '@/plugins/markdown';
import { PropertiesPlugin } from '@/plugins/properties/plugin';
import { AnnotationServiceImpl, IAnnotationService } from '@/plugins/properties/service/annotation';
import {
  getOrCreatePropertiesService,
  IPropertiesService,
  type PropertiesCollaborationProvider,
} from '@/plugins/properties/service/properties';
import type { AnnotationRecord } from '@/plugins/properties/types';
import { $getNodeId } from '@/plugins/properties/utils';
import { YjsPlugin } from '@/plugins/yjs/plugin';
import { YjsPropertiesProvider } from '@/plugins/yjs/plugin/properties-provider';
import { YjsService } from '@/plugins/yjs/service';

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

  const awareness: ProviderAwareness = {
    getLocalState: () => null,
    getStates: () => new Map(),
    off,
    on,
    setLocalState: () => undefined,
    setLocalStateField: () => undefined,
  };

  return {
    awareness,
    connect: () => undefined,
    disconnect: () => undefined,
    emitSync: () => listeners.get('sync')?.forEach((listener) => listener(true)),
    off,
    on,
  } as TestProvider;
};

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

const readFirstNodeId = (kernel: Kernel): string | undefined =>
  kernel
    .getLexicalEditor()!
    .getEditorState()
    .read(() => {
      const node = $getRoot().getFirstChild();
      return node ? $getNodeId(node) : undefined;
    });

describe('Properties collaboration service', () => {
  const kernels: Kernel[] = [];
  const docs: Doc[] = [];

  afterEach(() => {
    while (kernels.length > 0) kernels.pop()?.destroy();
    while (docs.length > 0) docs.pop()?.destroy();
  });

  it('provides standalone behavior and rejects overlapping providers', () => {
    const kernel = new Kernel();
    kernels.push(kernel);
    const service = getOrCreatePropertiesService(kernel);
    expect(kernel.requireService(IPropertiesService)).toBe(service);
    expect(service.getCollaborationProvider()).toBeNull();

    const provider = {
      attachAnnotationStorage: () => () => {},
      getNodeIdentity: () => undefined,
      getReadiness: () => 'ready' as const,
      subscribe: () => () => {},
    } satisfies PropertiesCollaborationProvider;
    const dispose = service.registerCollaborationProvider(provider);
    expect(service.getCollaborationProvider()).toBe(provider);
    expect(() => service.registerCollaborationProvider(provider)).toThrow(
      'only one collaboration provider',
    );
    dispose();
    dispose();
    const replacement = { ...provider };
    const disposeReplacement = service.registerCollaborationProvider(replacement);
    dispose();
    expect(service.getCollaborationProvider()).toBe(replacement);
    disposeReplacement();
    expect(service.getCollaborationProvider()).toBeNull();
  });

  it('retries a pending migration as standalone when its provider unregisters', async () => {
    const kernel = new Kernel();
    kernels.push(kernel);
    kernel.registerPlugins([CommonPlugin, MarkdownPlugin, PropertiesPlugin]);
    kernel.initHeadlessEditor();

    const service = kernel.requireService(IPropertiesService)!;
    const provider = {
      attachAnnotationStorage: () => () => {},
      getNodeIdentity: () => undefined,
      getReadiness: () => 'initializing' as const,
      subscribe: (listener: () => void) => {
        listener();
        return () => {};
      },
    } satisfies PropertiesCollaborationProvider;
    const dispose = service.registerCollaborationProvider(provider);

    kernel.setDocument('markdown', 'standalone after unregister');
    await flush();
    expect(readFirstNodeId(kernel)).toBeUndefined();

    dispose();
    await flush();
    expect(readFirstNodeId(kernel)).toBeTruthy();
  });

  it.each(['properties-first', 'yjs-first'] as const)(
    'keeps the provider initializing until sync in %s order',
    async (order) => {
      const doc = new Doc();
      const provider = createProvider();
      const kernel = new Kernel();
      docs.push(doc);
      kernels.push(kernel);
      const yjs = [
        YjsPlugin,
        {
          id: 'properties-service-room',
          providerFactory: () => provider,
          yjsDoc: doc,
        },
      ] as const;
      kernel.registerPlugin(CommonPlugin);
      kernel.registerPlugin(MarkdownPlugin);
      if (order === 'properties-first') {
        kernel.registerPlugin(PropertiesPlugin);
        kernel.registerPlugin(yjs[0], yjs[1]);
      } else {
        kernel.registerPlugin(yjs[0], yjs[1]);
        kernel.registerPlugin(PropertiesPlugin);
      }
      kernel.initHeadlessEditor();

      const service = kernel.requireService(IPropertiesService)!;
      expect(service.getCollaborationProvider()?.getReadiness()).toBe('initializing');

      kernel.setDocument('markdown', 'waiting for collaboration');
      await flush();
      expect(readFirstNodeId(kernel)).toBeUndefined();

      provider.emitSync();
      await flush();
      await flush();
      expect(service.getCollaborationProvider()?.getReadiness()).toBe('ready');
      expect(readFirstNodeId(kernel)).toBeTruthy();
    },
  );

  it('accepts a late Yjs registration without assigning a pre-sync local ID', async () => {
    const doc = new Doc();
    const provider = createProvider();
    const kernel = new Kernel();
    docs.push(doc);
    kernels.push(kernel);
    kernel.registerPlugins([CommonPlugin, MarkdownPlugin, PropertiesPlugin]);
    kernel.initHeadlessEditor();

    kernel.registerPlugin(YjsPlugin, {
      id: 'late-yjs-properties-room',
      providerFactory: () => provider,
      yjsDoc: doc,
    });
    const service = kernel.requireService(IPropertiesService)!;
    expect(service.getCollaborationProvider()?.getReadiness()).toBe('initializing');
    kernel.setDocument('markdown', 'late Yjs');
    await flush();
    expect(readFirstNodeId(kernel)).toBeUndefined();

    provider.emitSync();
    await flush();
    await flush();
    expect(service.getCollaborationProvider()?.getReadiness()).toBe('ready');
    expect(readFirstNodeId(kernel)).toBeTruthy();
  });

  it('supports late Properties registration and does not reseed a new room', async () => {
    const oldDoc = new Doc();
    const oldProvider = createProvider();
    const newDoc = new Doc();
    const newProvider = createProvider();
    const kernel = new Kernel();
    docs.push(oldDoc, newDoc);
    kernels.push(kernel);
    kernel.registerPlugins([
      CommonPlugin,
      MarkdownPlugin,
      [
        YjsPlugin,
        {
          id: 'properties-service-room',
          providerFactory: () => oldProvider,
          yjsDoc: oldDoc,
        },
      ],
    ]);
    kernel.initHeadlessEditor();
    kernel.setDocument('markdown', 'late Properties');
    oldProvider.emitSync();
    await flush();
    kernel.registerPlugin(PropertiesPlugin);
    await flush();

    const service = kernel.requireService(IPropertiesService)!;
    const oldPropertiesProvider = service.getCollaborationProvider();
    expect(oldPropertiesProvider?.getReadiness()).toBe('ready');
    const annotationService = kernel.requireService(IAnnotationService)!;
    annotationService.create({ id: 'old-room', payload: { value: 'old' } });
    expect(oldDoc.getMap('lobe:annotations').has('old-room')).toBe(true);

    kernel.registerPlugin(YjsPlugin, {
      id: 'properties-service-room',
      providerFactory: () => newProvider,
      yjsDoc: newDoc,
    });
    await flush();

    expect(service.getCollaborationProvider()).not.toBe(oldPropertiesProvider);
    expect(newDoc.getMap('lobe:annotations').has('old-room')).toBe(false);
    oldDoc.getMap('lobe:annotations').set('stale-room-write', {
      id: 'stale-room-write',
    });
    await flush();
    expect(annotationService.get('stale-room-write')).toBeNull();
  });

  it('keeps a newer same-provider annotation attachment after stale cleanup', () => {
    const service = new YjsService();
    const provider = new YjsPropertiesProvider(service);
    const doc = new Doc();
    const storage = {
      attachMap: vi.fn(),
      detachMap: vi.fn(),
    };
    const state = {
      binding: {},
      doc,
      docMap: new Map([['room', doc]]),
      id: 'room',
      provider: {},
    } as never;

    const disposeA = provider.attachAnnotationStorage(storage);
    service.setState(state);
    disposeA();
    const disposeB = provider.attachAnnotationStorage(storage);
    expect(storage.attachMap).toHaveBeenCalledTimes(2);
    disposeA();
    expect(storage.detachMap).toHaveBeenCalledTimes(1);
    disposeB();
    expect(storage.detachMap).toHaveBeenCalledTimes(2);
    doc.destroy();
  });

  it('does not reseed a detached room or let its stale owner detach the next map', () => {
    const docA = new Doc();
    const docB = new Doc();
    const mapA = docA.getMap<AnnotationRecord>('lobe:annotations');
    const mapB = docB.getMap<AnnotationRecord>('lobe:annotations');
    const annotationService = new AnnotationServiceImpl();
    const ownerA = {};
    const ownerB = {};
    annotationService.importSnapshot([
      {
        createdAt: '2024-01-01T00:00:00.000Z',
        id: 'initial-json',
        kind: 'comment',
        payload: { value: 'initial' },
        quotedText: '',
        status: 'active',
        updatedAt: '2024-01-01T00:00:00.000Z',
      },
    ]);
    annotationService.attachYMap(mapA, ownerA);
    expect(mapA.has('initial-json')).toBe(true);
    annotationService.create({ id: 'old-room', payload: { value: 'old' } });

    annotationService.detachYMap(mapA, ownerA);
    annotationService.importSnapshot([
      {
        createdAt: '2024-01-02T00:00:00.000Z',
        id: 'gap-import',
        kind: 'comment',
        payload: { value: 'gap' },
        quotedText: '',
        status: 'active',
        updatedAt: '2024-01-02T00:00:00.000Z',
      },
    ]);
    annotationService.attachYMap(mapB, ownerB);
    expect(mapB.size).toBe(0);

    annotationService.detachYMap(mapA, ownerA);
    annotationService.create({ id: 'new-room', payload: { value: 'new' } });
    expect(mapB.has('new-room')).toBe(true);
    expect(annotationService.get('old-room')).toBeNull();

    annotationService.detachYMap(mapB, ownerB);
    docA.destroy();
    docB.destroy();
  });
});
