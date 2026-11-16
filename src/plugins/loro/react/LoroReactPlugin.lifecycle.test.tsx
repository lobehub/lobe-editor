// @vitest-environment jsdom
import { act, StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import Editor from '@/editor-kernel';
import { ICollaborationService } from '@/common/collaboration';

const mocks = vi.hoisted(() => ({ editor: null as any }));
vi.mock('@/editor-kernel/react', async () => {
  const { useEffect: reactUseEffect } = await import('react');
  return {
    useLexicalComposerContext: () => [mocks.editor],
    useLexicalEditor: (handler: (editor: unknown) => (() => void) | undefined, deps: unknown[]) => {
      reactUseEffect(() => handler(mocks.editor.getLexicalEditor()), deps);
    },
  };
});

import { LoroReactPlugin } from './LoroReactPlugin';

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

describe('LoroReactPlugin lifecycle ownership', () => {
  let mount: HTMLDivElement;
  let root: ReturnType<typeof createRoot>;
  let service: any;
  let lexicalEditor: any;
  let kernelToDestroy: { destroy: () => void } | null = null;

  beforeEach(() => {
    mount = document.createElement('div');
    document.body.append(mount);
    root = createRoot(mount);
    lexicalEditor = {
      getEditorState: () => ({ read: (callback: () => void) => callback() }),
      registerUpdateListener: () => () => {},
    };
    service = {
      descriptor: { bindingSchema: 'lexical-loro-v1', engine: 'loro', epoch: 0 },
      dispose: vi.fn(),
      subscribeReadiness: () => () => {},
      transport: {
        clearPresence: vi.fn(),
        connect: vi.fn(),
        disconnect: vi.fn(),
        onStatus: () => () => {},
        onSync: () => () => {},
        setPresence: vi.fn(),
      },
    };
    mocks.editor = {
      getLexicalEditor: () => lexicalEditor,
      off: vi.fn(),
      on: vi.fn(),
      registerPlugin: vi.fn(),
      requireService: () => service,
    };
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    mount.remove();
    kernelToDestroy?.destroy();
    kernelToDestroy = null;
  });

  it('keeps the Kernel-owned service alive across StrictMode effect replay', async () => {
    await act(async () => {
      root.render(
        <StrictMode>
          <LoroReactPlugin presenceEnabled={false} />
        </StrictMode>,
      );
    });

    expect(service.dispose).not.toHaveBeenCalled();
    expect(service.transport.disconnect).not.toHaveBeenCalled();
    expect(mocks.editor.registerPlugin).toHaveBeenCalled();

    // A later effect replay must still observe the same live service rather
    // than receiving the terminated instance disposed by a stale cleanup.
    await act(async () => {
      root.render(
        <StrictMode>
          <LoroReactPlugin presenceEnabled={false} />
        </StrictMode>,
      );
    });
    expect(service.dispose).not.toHaveBeenCalled();
    expect(service.transport.disconnect).not.toHaveBeenCalled();
  });

  it('keeps a real binding alive across unmount/remount and releases it on kernel destroy', async () => {
    const kernel = Editor.createEditor();
    kernel.initHeadlessEditor();
    kernelToDestroy = kernel;
    mocks.editor = kernel;

    await act(async () => {
      root.render(
        <StrictMode>
          <LoroReactPlugin presenceEnabled={false} />
        </StrictMode>,
      );
    });
    const registeredService = kernel.requireService(ICollaborationService);
    expect(registeredService?.getReadiness()).not.toBe('disposed');

    await act(async () => root.unmount());
    await act(async () => {
      root = createRoot(mount);
      root.render(
        <StrictMode>
          <LoroReactPlugin presenceEnabled={false} />
        </StrictMode>,
      );
    });

    expect(kernel.requireService(ICollaborationService)).toBe(registeredService);
    expect(registeredService?.getReadiness()).not.toBe('disposed');

    await act(async () => root.unmount());
    kernel.destroy();
    kernelToDestroy = null;
    expect(registeredService?.getReadiness()).toBe('disposed');
  });
});
