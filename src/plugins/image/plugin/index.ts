import { LexicalEditor } from 'lexical';
import type { JSX } from 'react';

import { KernelPlugin } from '@/editor-kernel/plugin';
import { IMarkdownShortCutService } from '@/plugins/markdown/service/shortcut';
import { IUploadService, UPLOAD_PRIORITY_HIGH } from '@/plugins/upload';
import { IEditorKernel, IEditorPlugin, IEditorPluginConstructor } from '@/types';

import { INSERT_IMAGE_COMMAND, registerImageCommand } from '../command';
import { $isBlockImageNode, BlockImageNode } from '../node/block-image-node';
import { $isImageNode, ImageNode } from '../node/image-node';

export interface ImagePluginOptions {
  defaultBlockImage?: boolean;
  handleUpload: (file: File) => Promise<{ url: string }>;
  renderImage: (node: ImageNode | BlockImageNode) => JSX.Element | null;
  theme?: {
    blockImage?: string;
    image?: string;
  };
}

export const ImagePlugin: IEditorPluginConstructor<ImagePluginOptions> = class
  extends KernelPlugin
  implements IEditorPlugin<ImagePluginOptions>
{
  static readonly pluginName = 'ImagePlugin';

  constructor(
    protected kernel: IEditorKernel,
    public config?: ImagePluginOptions,
  ) {
    super();
    kernel.registerNodes([ImageNode, BlockImageNode]);
    ImageNode.setDecorate(config!.renderImage);
    BlockImageNode.setDecorate(config!.renderImage);
    if (config?.theme) {
      kernel.registerThemes(config.theme);
    }
  }

  onInit(editor: LexicalEditor): void {
    this.kernel
      .requireService(IMarkdownShortCutService)
      ?.registerMarkdownWriter(ImageNode.getType(), (ctx, node) => {
        if ($isImageNode(node)) {
          ctx.appendLine(`![${node.altText}](${node.src})`);
        }
      });
    this.kernel
      .requireService(IMarkdownShortCutService)
      ?.registerMarkdownWriter(BlockImageNode.getType(), (ctx, node) => {
        if ($isBlockImageNode(node)) {
          ctx.appendLine(`![${node.altText}](${node.src})\n\n`);
        }
      });
    this.kernel
      .requireService(IUploadService)
      ?.registerUpload(async (file: File, from: string, range?: Range | null) => {
        return editor.dispatchCommand(INSERT_IMAGE_COMMAND, {
          block: this.config?.defaultBlockImage,
          file,
          range,
        });
      }, UPLOAD_PRIORITY_HIGH);

    this.register(registerImageCommand(editor, this.config!.handleUpload));
  }
};
