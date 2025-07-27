import { genServiceId, IServiceID } from "@/editor-kernel";
import { LexicalNode } from "lexical";

export interface IUploadService {
    registerUpload(handler: (file: File, from: string) => Promise<LexicalNode | null>): void;
    uploadFile(file: File, from: string): Promise<LexicalNode>;
}

// eslint-disable-next-line @typescript-eslint/no-redeclare, no-redeclare
export const IUploadService: IServiceID<IUploadService> = genServiceId<IUploadService>('UploadService');

export class UploadService implements IUploadService {
    private uploadHandlers: Array<(file: File, from: string) => Promise<LexicalNode>> = [];

    registerUpload(handler: (file: File, from: string) => Promise<LexicalNode>): void {
        this.uploadHandlers.push(handler);
    }

    uploadFile(file: File, from: string): Promise<LexicalNode> {
        for (const handler of this.uploadHandlers) {
            const result = handler(file, from);
            if (result) {
                return result;
            }
        }
        return Promise.reject(new Error("No upload handler registered for this file type: " + file.type));
    }
}
