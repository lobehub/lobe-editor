import { describe, expect, it, vi } from 'vitest';

import { UPLOAD_PRIORITY_LOW, UploadService, type UploadHandler } from './i-upload-service';

const file = () => new File(['upload'], 'upload.txt', { type: 'text/plain' });

describe('UploadService', () => {
  it('returns independent idempotent disposers for duplicate handler registrations', async () => {
    const service = new UploadService();
    const handler: UploadHandler = vi.fn(async () => true);
    const unregisterFirst = service.registerUpload(handler);
    const unregisterSecond = service.registerUpload(handler);

    unregisterFirst();
    unregisterFirst();

    await expect(service.uploadFile(file(), 'test', null)).resolves.toBe(true);
    expect(handler).toHaveBeenCalledOnce();

    unregisterSecond();
    unregisterSecond();
    await expect(service.uploadFile(file(), 'test', null)).rejects.toThrow(
      'No upload handler registered',
    );
  });

  it('skips a handler disposed while an earlier handler is awaiting', async () => {
    const service = new UploadService();
    let releaseFirst!: () => void;
    const first = service.registerUpload(
      async () =>
        new Promise<boolean>((resolve) => {
          releaseFirst = () => resolve(false);
        }),
      UPLOAD_PRIORITY_LOW,
    );
    const secondHandler: UploadHandler = vi.fn(async () => true);
    const unregisterSecond = service.registerUpload(secondHandler, UPLOAD_PRIORITY_LOW);
    const thirdHandler: UploadHandler = vi.fn(async () => true);
    service.registerUpload(thirdHandler, UPLOAD_PRIORITY_LOW);

    const upload = service.uploadFile(file(), 'test', null);
    await Promise.resolve();
    unregisterSecond();
    releaseFirst();

    await expect(upload).resolves.toBe(true);
    expect(secondHandler).not.toHaveBeenCalled();
    expect(thirdHandler).toHaveBeenCalledOnce();
    first();
  });
});
