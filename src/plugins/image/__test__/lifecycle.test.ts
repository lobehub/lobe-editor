import { $getNodeByKey, $nodesOfType, type LexicalEditor } from 'lexical';
import { afterEach, describe, expect, it, vi } from 'vitest';

import Editor, { moment } from '@/editor-kernel';
import { CommonPlugin } from '@/plugins/common/plugin';
import { IUploadService } from '@/plugins/upload/service/i-upload-service';
import { UploadPlugin } from '@/plugins/upload/plugin';

import { INSERT_BLOCK_IMAGE_COMMAND, INSERT_IMAGE_COMMAND } from '../command';
import { $isBlockImageNode, BlockImageNode } from '../node/block-image-node';
import { $isImageNode, ImageNode } from '../node/image-node';
import { ImagePlugin, type ImagePluginOptions } from '../plugin';

type UploadPath = 'command' | 'service';
type Settlement = 'resolve' | 'reject';

const kernels: Array<ReturnType<typeof Editor.createEditor>> = [];

const createDeferred = <T>() => {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((promiseResolve, promiseReject) => {
    resolve = promiseResolve;
    reject = promiseReject;
  });
  return { promise, reject, resolve };
};

const flush = async () => {
  await Promise.resolve();
  await Promise.resolve();
  await moment();
};

const readImage = (editor: LexicalEditor, key?: string) =>
  editor.getEditorState().read(() => {
    const node = key
      ? $getNodeByKey(key)
      : ($nodesOfType(BlockImageNode)[0] ?? $nodesOfType(ImageNode)[0]);
    if (!node || (!$isImageNode(node) && !$isBlockImageNode(node))) return undefined;
    return {
      key: node.getKey(),
      src: node.src,
      status: node.status,
      type: node.getType(),
    };
  });

const createKernel = (
  path: UploadPath,
  handleUpload: (file: File) => Promise<{ url: string }>,
  options: Omit<ImagePluginOptions, 'handleUpload'> = {},
) => {
  const imagePlugin: [typeof ImagePlugin, ImagePluginOptions] = [
    ImagePlugin,
    { ...options, handleUpload },
  ];
  const kernel = Editor.createEditor().registerPlugins(
    path === 'service' ? [CommonPlugin, UploadPlugin, imagePlugin] : [CommonPlugin, imagePlugin],
  );
  kernels.push(kernel);
  return kernel;
};

const startUpload = async (
  kernel: ReturnType<typeof Editor.createEditor>,
  path: UploadPath,
  block = true,
) => {
  const editor = kernel.getLexicalEditor()!;
  const file = new File(['image'], 'pending.png', { type: 'image/png' });
  if (path === 'service') {
    const service = kernel.requireService(IUploadService);
    if (!service) throw new Error('Upload service is not registered');
    await expect(service.uploadFile(file, 'probe', null)).resolves.toBe(true);
  } else {
    expect(editor.dispatchCommand(INSERT_IMAGE_COMMAND, { block, file })).toBe(true);
  }
  await moment();
  const image = editor
    .getEditorState()
    .read(() => (block ? $nodesOfType(BlockImageNode)[0] : $nodesOfType(ImageNode)[0]));
  if (!image) throw new Error('Image placeholder missing');
  return image;
};

afterEach(() => {
  while (kernels.length > 0) {
    try {
      kernels.pop()?.destroy();
    } catch {}
  }
});

describe('ImagePlugin async lifecycle', () => {
  it.each(['command', 'service'] as const)('settles a normal %s upload', async (path) => {
    const deferred = createDeferred<{ url: string }>();
    const kernel = createKernel(path, async () => deferred.promise);
    kernel.initHeadlessEditor();
    const editor = kernel.getLexicalEditor()!;
    const pending = await startUpload(kernel, path);

    expect(readImage(editor, pending.getKey())).toMatchObject({ status: 'loading' });
    deferred.resolve({ url: 'https://example.test/uploaded.png' });
    await flush();

    expect(readImage(editor, pending.getKey())).toMatchObject({
      src: 'https://example.test/uploaded.png',
      status: 'uploaded',
    });
  });

  it.each(['command', 'service'] as const)('settles a failed %s upload', async (path) => {
    const deferred = createDeferred<{ url: string }>();
    const kernel = createKernel(path, async () => deferred.promise);
    kernel.initHeadlessEditor();
    const editor = kernel.getLexicalEditor()!;
    const pending = await startUpload(kernel, path);

    deferred.reject(new Error('upload failed'));
    await flush();

    expect(readImage(editor, pending.getKey())).toMatchObject({ status: 'error' });
  });

  it.each(['command', 'service'] as const)(
    'ignores a deferred %s upload after kernel destroy and reinit',
    async (path) => {
      const deferred = createDeferred<{ url: string }>();
      const kernel = createKernel(path, async () => deferred.promise);
      kernel.initHeadlessEditor();
      const oldEditor = kernel.getLexicalEditor()!;
      const pending = await startUpload(kernel, path);
      let oldUpdates = 0;
      const unregisterOldUpdates = oldEditor.registerUpdateListener(() => {
        oldUpdates += 1;
      });
      const oldService = kernel.requireService(IUploadService);

      kernel.destroy();
      const newEditor = kernel.initHeadlessEditor()!;
      deferred.resolve({ url: 'https://example.test/old.png' });
      await flush();

      expect(oldUpdates).toBe(0);
      expect(readImage(oldEditor, pending.getKey())).toMatchObject({ status: 'loading' });
      expect(newEditor.getEditorState().read(() => $nodesOfType(BlockImageNode))).toHaveLength(0);
      if (path === 'service') {
        await expect(
          oldService!.uploadFile(
            new File(['old'], 'after-destroy.png', { type: 'image/png' }),
            'probe',
            null,
          ),
        ).rejects.toThrow('No upload handler registered');
      }
      unregisterOldUpdates();
    },
  );

  it.each(['resolve', 'reject'] as const)(
    'does not settle a deleted image (%s)',
    async (settlement) => {
      const deferred = createDeferred<{ url: string }>();
      const kernel = createKernel('command', async () => deferred.promise);
      kernel.initHeadlessEditor();
      const editor = kernel.getLexicalEditor()!;
      const pending = await startUpload(kernel, 'command');
      let updates = 0;
      const unregister = editor.registerUpdateListener(() => {
        updates += 1;
      });
      editor.update(() => {
        $getNodeByKey(pending.getKey())?.remove();
      });
      await moment();
      const updatesAfterDelete = updates;

      if (settlement === 'resolve') deferred.resolve({ url: 'https://example.test/deleted.png' });
      else deferred.reject(new Error('upload failed'));
      await flush();

      expect(updates).toBe(updatesAfterDelete);
      expect(readImage(editor, pending.getKey())).toBeUndefined();
      unregister();
    },
  );

  it('does not dispatch a service upload after delayed width calculation observes disposal', async () => {
    const width = createDeferred<number>();
    const handleUpload = vi.fn(async () => ({ url: 'https://example.test/never.png' }));
    const kernel = createKernel('service', handleUpload, {
      getImageWidth: async () => width.promise,
    });
    kernel.initHeadlessEditor();
    const service = kernel.requireService(IUploadService)!;
    const upload = service.uploadFile(
      new File(['image'], 'width.png', { type: 'image/png' }),
      'probe',
      null,
    );
    await Promise.resolve();
    kernel.destroy();
    width.resolve(640);

    await expect(upload).rejects.toThrow('No upload handler registered');
    expect(handleUpload).not.toHaveBeenCalled();
  });

  it.each(['resolve', 'reject'] as const)(
    'guards delayed rehost after destroy (%s)',
    async (settlement) => {
      const deferred = createDeferred<{ url: string }>();
      const oldUrl = 'https://example.test/rehost.png';
      const kernel = Editor.createEditor().registerPlugins([
        CommonPlugin,
        [
          ImagePlugin,
          {
            handleRehost: async () => deferred.promise,
            needRehost: (url: string) => url === oldUrl,
          },
        ],
      ]);
      kernels.push(kernel);
      kernel.initHeadlessEditor();
      const editor = kernel.getLexicalEditor()!;
      expect(editor.dispatchCommand(INSERT_BLOCK_IMAGE_COMMAND, { src: oldUrl })).toBe(true);
      await moment();
      let oldUpdates = 0;
      const unregister = editor.registerUpdateListener(() => {
        oldUpdates += 1;
      });

      kernel.destroy();
      if (settlement === 'resolve') deferred.resolve({ url: 'https://example.test/rehosted.png' });
      else deferred.reject(new Error('rehost failed'));
      await flush();

      expect(oldUpdates).toBe(0);
      unregister();
    },
  );
});
