import { LexicalEditor } from 'lexical';
import { JSX } from 'react';

import { KernelPlugin } from '@/editor-kernel/plugin';
import { IEditorKernel, IEditorPlugin, IEditorPluginConstructor } from '@/editor-kernel/types';
import { IMarkdownShortCutService } from '@/plugins/markdown/service/shortcut';
import { IUploadService, UPLOAD_PRIORITY_HIGH } from '@/plugins/upload';

import { INSERT_IMAGE_COMMAND, registerImageCommand } from '../command';
import { $isImageNode, ImageNode } from '../node/image-node';

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

    kernel
      .requireService(IMarkdownShortCutService)
      ?.registerMarkdownWriter(ImageNode.getType(), (ctx, node) => {
        if ($isImageNode(node)) {
          ctx.appendLine(`![${node.altText}](${node.src})`);
        }
      });
  }

  onInit(editor: LexicalEditor): void {
    // Register the upload handler if provided
    this.kernel
      .requireService(IUploadService)
      ?.registerUpload(async (file: File, from: string, range?: Range | null) => {
        return editor.dispatchCommand(INSERT_IMAGE_COMMAND, { file, range });
      }, UPLOAD_PRIORITY_HIGH);

    this.register(registerImageCommand(editor, this.config!.handleUpload));
  }
};
