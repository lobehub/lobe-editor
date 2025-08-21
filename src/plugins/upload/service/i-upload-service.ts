import { genServiceId } from '@/editor-kernel';
import type { IServiceID } from '@/types';

export const UPLOAD_PRIORITY_LOW = 2;
export const UPLOAD_PRIORITY_MEDIUM = 1;
export const UPLOAD_PRIORITY_HIGH = 0;

export type UPLOAD_PRIORITY =
  | typeof UPLOAD_PRIORITY_LOW
  | typeof UPLOAD_PRIORITY_MEDIUM
  | typeof UPLOAD_PRIORITY_HIGH;

export interface IUploadService {
  registerUpload(
    handler: (file: File, from: string, range: Range | null | undefined) => Promise<boolean | null>,
    priority?: UPLOAD_PRIORITY,
  ): void;
  uploadFile(file: File, from: string, range: Range | null | undefined): Promise<boolean>;
}

// eslint-disable-next-line @typescript-eslint/no-redeclare, no-redeclare
export const IUploadService: IServiceID<IUploadService> =
  genServiceId<IUploadService>('UploadService');

export class UploadService implements IUploadService {
  private uploadHandlers: [
    // eslint-disable-next-line unused-imports/no-unused-vars
    Array<(file: File, from: string, range: Range | null | undefined) => Promise<boolean>>,
    // eslint-disable-next-line unused-imports/no-unused-vars
    Array<(file: File, from: string, range: Range | null | undefined) => Promise<boolean>>,
    // eslint-disable-next-line unused-imports/no-unused-vars
    Array<(file: File, from: string, range: Range | null | undefined) => Promise<boolean>>,
  ] = [[], [], []];

  registerUpload(
    handler: (file: File, from: string, range: Range | null | undefined) => Promise<boolean>,
    priority = UPLOAD_PRIORITY_LOW,
  ): void {
    this.uploadHandlers[priority].push(handler);
  }

  async uploadFile(file: File, from: string, range: Range | null | undefined): Promise<boolean> {
    for (const uploadHandlers of this.uploadHandlers) {
      if (uploadHandlers.length === 0) {
        continue; // Skip empty handler arrays
      }
      for (const handler of uploadHandlers) {
        const result = await handler(file, from, range);
        if (result) {
          return result;
        }
      }
    }
    console.error('No upload handler registered for this file type: ' + file.type);
    return false;
  }
}
