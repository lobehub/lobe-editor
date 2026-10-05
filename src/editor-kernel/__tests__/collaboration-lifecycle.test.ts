import type { Provider } from '@lexical/yjs';
import { $getRoot, COMMAND_PRIORITY_CRITICAL, KEY_DOWN_COMMAND } from 'lexical';
import { applyUpdate, Doc } from 'yjs';
import { describe, expect, it, vi } from 'vitest';

import { HOVER_COMMAND } from '@/editor-kernel';
import { Kernel } from '@/editor-kernel/kernel';
import { CommonPlugin } from '@/plugins/common';
import { registerCollaborationBinding } from '@/plugins/collaboration/utils';
import { IYjsService, YjsPlugin } from '@/plugins/yjs';

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

const textContent = (kernel: Kernel): string =>
  kernel
    .getLexicalEditor()!
    .getEditorState()
    .read(() => $getRoot().getTextContent());

describe('collaboration editor lifecycle', () => {
  it('does not clear a peer when an externally-owned collaboration binding is destroyed', async () => {
    const docA = new Doc();
    const docB = new Doc();
    const providerA = createProvider();
    const providerB = createProvider();
    connectDocs(docA, providerA, docB, providerB);
    const kernelA = new Kernel().registerPlugins([CommonPlugin]) as Kernel;
    const kernelB = new Kernel().registerPlugins([CommonPlugin]) as Kernel;
    const rootA = document.createElement('div');
    const rootB = document.createElement('div');
    document.body.append(rootA, rootB);
    const lexicalA = kernelA.setRootElement(rootA);
    const lexicalB = kernelB.setRootElement(rootB);
    kernelA.setDocument('text', 'shared binding content');
    kernelB.setDocument('text', '');

    const bindingA = registerCollaborationBinding({
      doc: docA,
      id: 'lifecycle-v2-room',
      lexicalEditor: lexicalA,
      provider: providerA,
      shouldBootstrap: true,
      syncCursorPositionsFn: () => {},
      yjsDocMap: new Map([['lifecycle-v2-room', docA]]),
    });
    const bindingB = registerCollaborationBinding({
      doc: docB,
      id: 'lifecycle-v2-room',
      lexicalEditor: lexicalB,
      provider: providerB,
      syncCursorPositionsFn: () => {},
      yjsDocMap: new Map([['lifecycle-v2-room', docB]]),
    });

    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(textContent(kernelB)).toBe('shared binding content');

    kernelA.destroy();
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(textContent(kernelB)).toBe('shared binding content');

    bindingA.cleanup();
    bindingB.cleanup();
    kernelB.destroy();
    rootA.remove();
    rootB.remove();
    docA.destroy();
    docB.destroy();
  });

  it('does not publish an empty state from destroy and reinitializes plugins', async () => {
    const docA = new Doc();
    const docB = new Doc();
    const providerA = createProvider();
    const providerB = createProvider();
    connectDocs(docA, providerA, docB, providerB);

    const kernelA = new Kernel();
    const kernelB = new Kernel();
    for (const kernel of [kernelA, kernelB]) {
      kernel.registerPlugins([
        [CommonPlugin, { enableHotkey: false }],
        [
          YjsPlugin,
          {
            id: 'lifecycle-room',
            providerFactory: () => (kernel === kernelA ? providerA : providerB),
            yjsDoc: kernel === kernelA ? docA : docB,
          },
        ],
      ]);
    }

    const rootA = document.createElement('div');
    const rootB = document.createElement('div');
    rootA.contentEditable = 'true';
    rootB.contentEditable = 'true';
    document.body.append(rootA, rootB);
    const lexicalA = kernelA.setRootElement(rootA);
    kernelB.setRootElement(rootB);
    kernelA.setDocument('text', 'shared before destroy');
    providerA.emitSync();
    await new Promise((resolve) => setTimeout(resolve, 0));
    providerB.emitSync();
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(textContent(kernelB)).toBe('shared before destroy');

    const oldRootCommand = vi.fn(() => false);
    lexicalA.registerCommand(HOVER_COMMAND, oldRootCommand, COMMAND_PRIORITY_CRITICAL);
    rootA.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
    expect(oldRootCommand).toHaveBeenCalledTimes(1);
    const oldRootKeyCommand = vi.fn(() => false);
    lexicalA.registerCommand(KEY_DOWN_COMMAND, oldRootKeyCommand, COMMAND_PRIORITY_CRITICAL);
    rootA.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: 'F2' }));
    expect(oldRootKeyCommand).toHaveBeenCalledTimes(1);

    kernelA.destroy();
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(textContent(kernelB)).toBe('shared before destroy');
    rootA.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
    expect(oldRootCommand).toHaveBeenCalledTimes(1);
    rootA.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: 'F2' }));
    expect(oldRootKeyCommand).toHaveBeenCalledTimes(1);
    expect(kernelA.getLexicalEditor()).toBeNull();

    const rootA2 = document.createElement('div');
    rootA2.contentEditable = 'true';
    document.body.append(rootA2);
    const lexicalA2 = kernelA.setRootElement(rootA2);
    expect(lexicalA2).not.toBe(lexicalA);
    expect(kernelA.requireService(IYjsService)).not.toBeNull();
    providerA.emitSync();
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(textContent(kernelA)).toBe('shared before destroy');
    expect(textContent(kernelB)).toBe('shared before destroy');

    kernelB.destroy();
    kernelA.destroy();
    rootA.remove();
    rootA2.remove();
    rootB.remove();
    docA.destroy();
    docB.destroy();
  });
});
