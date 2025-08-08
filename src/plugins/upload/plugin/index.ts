import { COMMAND_PRIORITY_HIGH, DROP_COMMAND, LexicalEditor, PASTE_COMMAND } from 'lexical';

import { IEditorPlugin } from '@/editor-kernel';
import { KernelPlugin } from '@/editor-kernel/plugin';
import { IEditorKernel, IEditorPluginConstructor } from '@/editor-kernel/types';

import { IUploadService, UploadService } from '../service/i-upload-service';

// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface UploadPluginOptions {
  // Define any options specific to the upload plugin
}

export const UploadPlugin: IEditorPluginConstructor<UploadPluginOptions> = class
  extends KernelPlugin
  implements IEditorPlugin<UploadPluginOptions>
{
  static readonly pluginName = 'upload';

  constructor(
    protected kernel: IEditorKernel,
    public config?: UploadPluginOptions,
  ) {
    super();
    // Register the upload service
    kernel.registerService(IUploadService, new UploadService());
  }

  onInit(editor: LexicalEditor): void {
    this.register(
      editor.registerCommand(
        DROP_COMMAND,
        (event) => {
          const dataTransfer = event.dataTransfer;
          if (dataTransfer && dataTransfer.files.length > 0) {
            const file = dataTransfer.files[0];
            const uploadService = this.kernel.requireService(IUploadService);
            if (uploadService) {
              uploadService.uploadFile(file, 'drop').catch((error) => {
                console.error('Upload failed:', error);
              });
            }
          }
          return true; // Prevent further handling of the drop event
        },
        COMMAND_PRIORITY_HIGH,
      ),
    );
    this.register(
      editor.registerCommand(
        PASTE_COMMAND,
        (event) => {
          if (!('clipboardData' in event)) return false; // Ensure clipboardData is available
          const clipboardData = event.clipboardData;
          if (clipboardData?.types.length === 1 && clipboardData.types.includes('Files')) {
            const file = clipboardData.files[0];
            const uploadService = this.kernel.requireService(IUploadService);
            if (uploadService) {
              uploadService.uploadFile(file, 'paste').catch((error) => {
                console.error('Upload failed:', error);
              });
            }
            return true; // Prevent further handling of the paste event
          }
          return false; // Prevent further handling of the paste event
        },
        COMMAND_PRIORITY_HIGH,
      ),
    );
  }
};
