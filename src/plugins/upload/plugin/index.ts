import { DRAG_DROP_PASTE } from '@lexical/rich-text';
import { COMMAND_PRIORITY_HIGH, DROP_COMMAND, LexicalEditor } from 'lexical';

import { KernelPlugin } from '@/editor-kernel/plugin';
import type { IEditorKernel, IEditorPlugin, IEditorPluginConstructor } from '@/types';
import { createDebugLogger } from '@/utils/debug';

import { IUploadService, UploadService } from '../service/i-upload-service';
import { getDragSelection } from '../utils';

// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface UploadPluginOptions {
  // Define any options specific to the upload plugin
}

export const UploadPlugin: IEditorPluginConstructor<UploadPluginOptions> = class
  extends KernelPlugin
  implements IEditorPlugin<UploadPluginOptions>
{
  static readonly pluginName = 'upload';
  private logger = createDebugLogger('plugin', 'upload');

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
            event.preventDefault();
            event.stopImmediatePropagation();
            const file = dataTransfer.files[0];
            const uploadService = this.kernel.requireService(IUploadService);
            if (uploadService) {
              uploadService.uploadFile(file, 'drop', getDragSelection(event)).catch((error) => {
                this.logger.error('Upload failed:', error);
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
              uploadService.uploadFile(file, 'drag-drop-paste', null).catch((error) => {
                this.logger.error('Upload failed:', error);
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
