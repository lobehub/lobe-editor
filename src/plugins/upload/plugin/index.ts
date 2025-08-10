import { DRAG_DROP_PASTE } from '@lexical/rich-text';
import { COMMAND_PRIORITY_HIGH, DROP_COMMAND, LexicalEditor } from 'lexical';

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
        DRAG_DROP_PASTE,
        (files) => {
          for (const file of files) {
            const uploadService = this.kernel.requireService(IUploadService);
            if (uploadService) {
              uploadService.uploadFile(file, 'drag-drop-paste').catch((error) => {
                console.error('Upload failed:', error);
              });
            }
          }
          return true;
        },
        COMMAND_PRIORITY_HIGH,
      ),
    );
  }
};
