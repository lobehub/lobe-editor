import { $getNodeByKey, $nodesOfType, type LexicalEditor } from 'lexical';
import { afterEach, describe, expect, it } from 'vitest';

import Editor, { moment } from '@/editor-kernel';
import { CommonPlugin } from '@/plugins/common/plugin';
import { MarkdownPlugin } from '@/plugins/markdown/plugin';
import { IUploadService } from '@/plugins/upload/service/i-upload-service';
import { UploadPlugin } from '@/plugins/upload/plugin';

import { INSERT_FILE_COMMAND } from '../command';
import { $isBlockFileNode, BlockFileNode } from '../node/BlockFileNode';
import { $isFileNode, FileNode } from '../node/FileNode';
import { FilePlugin, type FilePluginOptions } from '../plugin';

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

const createKernel = (
  path: UploadPath,
  handleUpload: (file: File) => Promise<{ url: string }>,
  defaultBlockFile = false,
) => {
  const kernel = Editor.createEditor();
  const filePlugin: [typeof FilePlugin, FilePluginOptions] = [
    FilePlugin,
    { defaultBlockFile, handleUpload },
  ];
  if (path === 'service') {
    kernel.registerPlugins([CommonPlugin, MarkdownPlugin, UploadPlugin, filePlugin]);
  } else {
    kernel.registerPlugins([CommonPlugin, MarkdownPlugin, filePlugin]);
  }
  kernels.push(kernel);
  return kernel;
};

const readFile = (editor: LexicalEditor, key?: string) =>
  editor.getEditorState().read(() => {
    const node = key ? $getNodeByKey(key) : $nodesOfType(FileNode)[0];
    if (!node || (!$isFileNode(node) && !$isBlockFileNode(node))) return undefined;
    return {
      key: node.getKey(),
      status: node.status,
      type: node.getType(),
      url: node.fileUrl,
    };
  });

const startUpload = async (
  kernel: ReturnType<typeof Editor.createEditor>,
  path: UploadPath,
): Promise<NonNullable<ReturnType<typeof readFile>>> => {
  const lexical = kernel.getLexicalEditor()!;
  const file = new File(['pending'], 'pending.txt', { type: 'text/plain' });
  if (path === 'service') {
    const uploadService = kernel.requireService(IUploadService);
    if (!uploadService) throw new Error('Upload service is not registered');
    await expect(uploadService.uploadFile(file, 'programmatic', null)).resolves.toBe(true);
  } else {
    lexical.dispatchCommand(INSERT_FILE_COMMAND, { file });
  }
  await moment();
  const pending = readFile(lexical);
  if (!pending) throw new Error('Pending file was not inserted');
  return pending;
};

const settle = async (
  deferred: ReturnType<typeof createDeferred<{ url: string }>>,
  settlement: Settlement,
) => {
  if (settlement === 'resolve') {
    deferred.resolve({ url: 'https://example.test/pending.txt' });
  } else {
    deferred.reject(new Error('upload failed'));
  }
  await Promise.resolve();
  await moment();
};

afterEach(() => {
  while (kernels.length > 0) {
    try {
      kernels.pop()?.destroy();
    } catch {}
  }
});

describe('FilePlugin upload lifecycle', () => {
  it.each(['command', 'service'] as const)('settles a normal %s upload', async (path) => {
    const deferred = createDeferred<{ url: string }>();
    const kernel = createKernel(path, async () => deferred.promise);
    kernel.initHeadlessEditor();
    const lexical = kernel.getLexicalEditor()!;
    const pending = await startUpload(kernel, path);
    expect(pending.status).toBe('pending');

    if (path === 'service') {
      const uploadService = kernel.requireService(IUploadService);
      expect(uploadService).not.toBeNull();
    }
    await settle(deferred, 'resolve');

    expect(readFile(lexical, pending?.key)).toMatchObject({
      status: 'uploaded',
      type: 'file',
      url: 'https://example.test/pending.txt',
    });
  });

  it('preserves defaultBlockFile for the command path', async () => {
    const kernel = createKernel(
      'command',
      async () => ({ url: 'https://example.test/block.txt' }),
      true,
    );
    kernel.initHeadlessEditor();
    const lexical = kernel.getLexicalEditor()!;
    lexical.dispatchCommand(INSERT_FILE_COMMAND, {
      file: new File(['block'], 'block.txt', { type: 'text/plain' }),
    });
    await Promise.resolve();
    await moment();

    lexical.getEditorState().read(() => {
      expect($nodesOfType(BlockFileNode)).toHaveLength(1);
      expect($nodesOfType(FileNode)).toHaveLength(0);
    });
  });

  it.each([
    ['command', 'resolve'],
    ['command', 'reject'],
    ['service', 'resolve'],
    ['service', 'reject'],
  ] as const)(
    'ignores a deferred %s upload after kernel destroy and reinit (%s)',
    async (path, settlement) => {
      const deferred = createDeferred<{ url: string }>();
      const kernel = createKernel(path, async () => deferred.promise);
      kernel.initHeadlessEditor();
      kernel.setDocument('markdown', 'before');
      await moment();

      const oldLexical = kernel.getLexicalEditor()!;
      const pending = await startUpload(kernel, path);
      expect(pending.key).toBeTruthy();

      let oldUpdates = 0;
      const unregisterOldUpdates = oldLexical.registerUpdateListener(() => {
        oldUpdates += 1;
      });
      const oldUploadService = kernel.requireService(IUploadService);
      kernel.destroy();

      const newLexical = kernel.initHeadlessEditor()!;
      kernel.setDocument('markdown', 'after');
      await moment();
      let newUpdates = 0;
      const unregisterNewUpdates = newLexical.registerUpdateListener(() => {
        newUpdates += 1;
      });

      if (path === 'service') {
        expect(oldUploadService).not.toBeNull();
        await expect(
          oldUploadService!.uploadFile(
            new File(['after destroy'], 'after-destroy.txt', { type: 'text/plain' }),
            'programmatic',
            null,
          ),
        ).rejects.toThrow('No upload handler registered');
      }

      await settle(deferred, settlement);

      expect(oldUpdates).toBe(0);
      expect(newUpdates).toBe(0);
      expect(readFile(oldLexical, pending?.key)).toMatchObject({ status: 'pending' });
      expect(newLexical.getEditorState().read(() => $nodesOfType(FileNode))).toHaveLength(0);
      unregisterOldUpdates();
      unregisterNewUpdates();
    },
  );

  it.each(['resolve', 'reject'] as const)(
    'keeps a deleted file safe for both registration paths (%s)',
    async (settlement) => {
      for (const path of ['command', 'service'] as const) {
        const deferred = createDeferred<{ url: string }>();
        const kernel = createKernel(path, async () => deferred.promise);
        kernel.initHeadlessEditor();
        const lexical = kernel.getLexicalEditor()!;
        const pending = await startUpload(kernel, path);
        let updates = 0;
        const unregister = lexical.registerUpdateListener(() => {
          updates += 1;
        });

        lexical.update(() => {
          $getNodeByKey(pending!.key)?.remove();
        });
        await moment();
        const updatesAfterDelete = updates;
        await settle(deferred, settlement);

        expect(updates).toBe(updatesAfterDelete);
        expect(readFile(lexical, pending?.key)).toBeUndefined();
        unregister();
        kernel.destroy();
        kernels.splice(kernels.indexOf(kernel), 1);
      }
    },
  );
});
