import { LexicalEditor } from 'lexical';
import { JSX } from 'react';

import { KernelPlugin } from '@/editor-kernel/plugin';
import { IEditorKernel, IEditorPlugin, IEditorPluginConstructor } from '@/editor-kernel/types';
import { IUploadService, UPLOAD_PRIORITY_HIGH } from '@/plugins/upload';

import { INSERT_IMAGE_COMMAND, registerImageCommand } from '../command';
import { ImageNode } from '../node/image-node';

export interface ImagePluginOptions {
  handleUpload: (file: File) => Promise<{ url: string }>;
  renderImage: (node: ImageNode) => JSX.Element | null;
  theme?: {
    image?: string;
  };
}

export const ImagePlugin: IEditorPluginConstructor<ImagePluginOptions> = class
  extends KernelPlugin
  implements IEditorPlugin<ImagePluginOptions>
{
  static readonly pluginName = 'image';

  constructor(
    protected kernel: IEditorKernel,
    public config?: ImagePluginOptions,
  ) {
    super();
    kernel.registerNodes([ImageNode]);
    ImageNode.setDecorate(config!.renderImage);
    if (config?.theme) {
      kernel.registerThemes(config.theme);
    }
  }

  onInit(editor: LexicalEditor): void {
    // Register the upload handler if provided
    this.kernel.requireService(IUploadService)?.registerUpload(async (file: File) => {
      editor.dispatchCommand(INSERT_IMAGE_COMMAND, { file });
      return true;
    }, UPLOAD_PRIORITY_HIGH);

    this.register(registerImageCommand(editor, this.config!.handleUpload));
  }
};
