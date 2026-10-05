import { genServiceId } from '@/editor-kernel';
import type { IServiceID } from '@/types';

export const UPLOAD_PRIORITY_LOW = 2;
export const UPLOAD_PRIORITY_MEDIUM = 1;
export const UPLOAD_PRIORITY_HIGH = 0;

export type UPLOAD_PRIORITY =
  typeof UPLOAD_PRIORITY_LOW | typeof UPLOAD_PRIORITY_MEDIUM | typeof UPLOAD_PRIORITY_HIGH;

export type UploadHandler = (
  file: File,
  from: string,
  range: Range | null | undefined,
) => Promise<boolean | null>;

export interface IUploadService {
  registerUpload(handler: UploadHandler, priority?: UPLOAD_PRIORITY): () => void;
  uploadFile(file: File, from: string, range: Range | null | undefined): Promise<boolean>;
}

export const IUploadService: IServiceID<IUploadService> =
  genServiceId<IUploadService>('UploadService');

interface UploadRegistration {
  active: boolean;
  handler: UploadHandler;
}

export class UploadService implements IUploadService {
  private uploadHandlers: [UploadRegistration[], UploadRegistration[], UploadRegistration[]] = [
    [],
    [],
    [],
  ];

  registerUpload(handler: UploadHandler, priority = UPLOAD_PRIORITY_LOW): () => void {
    const registration: UploadRegistration = { active: true, handler };
    this.uploadHandlers[priority].push(registration);

    let registered = true;
    return () => {
      if (!registered) return;
      registered = false;
      registration.active = false;
      const registrations = this.uploadHandlers[priority];
      const index = registrations.indexOf(registration);
      if (index !== -1) registrations.splice(index, 1);
    };
  }

  async uploadFile(file: File, from: string, range: Range | null | undefined): Promise<boolean> {
    for (const uploadHandlers of this.uploadHandlers) {
      const registrations = uploadHandlers.slice();
      if (registrations.length === 0) {
        continue; // Skip empty handler arrays
      }
      for (const registration of registrations) {
        if (!registration.active) continue;
        const result = await registration.handler(file, from, range);
        if (result) {
          return result;
        }
      }
    }
    throw new Error('No upload handler registered for this file type: ' + file.type);
  }
}
