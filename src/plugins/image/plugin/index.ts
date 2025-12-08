import { LexicalEditor } from 'lexical';
import type { JSX } from 'react';

import { INodeHelper } from '@/editor-kernel/inode/helper';
import { KernelPlugin } from '@/editor-kernel/plugin';
import { ILitexmlService } from '@/plugins/litexml';
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
    this.register(
      registerImageCommand(editor, this.config!.handleUpload, this.config?.defaultBlockImage),
    );

    this.registerMarkdown();
    this.registerLiteXml();
    this.registerUpload(editor);
  }

  private registerUpload(editor: LexicalEditor) {
    const uploadService = this.kernel.requireService(IUploadService);
    if (!uploadService) {
      return;
    }

    uploadService.registerUpload(async (file: File, from: string, range?: Range | null) => {
      // Get image dimensions before uploading
      const imageWidth = await this.getImageWidth(file);

      return editor.dispatchCommand(INSERT_IMAGE_COMMAND, {
        block: this.config?.defaultBlockImage,
        file,
        maxWidth: imageWidth,
        range,
      });
    }, UPLOAD_PRIORITY_HIGH);
  }

  private registerLiteXml() {
    const litexmlService = this.kernel.requireService(ILitexmlService);
    if (!litexmlService) {
      return;
    }

    litexmlService.registerXMLWriter(ImageNode.getType(), (node, ctx) => {
      if ($isImageNode(node)) {
        const attributes: { [key: string]: string } = {
          src: node.src,
        };
        if (node.altText) {
          attributes.alt = node.altText;
        }
        return ctx.createXmlNode('img', attributes);
      }
      return false;
    });
    litexmlService.registerXMLWriter(BlockImageNode.getType(), (node, ctx) => {
      if ($isBlockImageNode(node)) {
        const attributes: { [key: string]: string } = {
          block: 'true',
          src: node.src,
        };
        if (node.altText) {
          attributes.alt = node.altText;
        }
        if (node.width) {
          attributes.width = String(node.width);
        }
        if (node.maxWidth) {
          attributes['max-width'] = String(node.maxWidth);
        }
        return ctx.createXmlNode('img', attributes);
      }
      return false;
    });
    litexmlService.registerXMLReader('img', (xmlNode) => {
      if (xmlNode.getAttribute('block') === 'true') {
        return INodeHelper.createElementNode(BlockImageNode.getType(), {
          altText: xmlNode.getAttribute('alt') || '',
          maxWidth: xmlNode.getAttribute('max-width')
            ? parseInt(xmlNode.getAttribute('max-width') as string, 10)
            : undefined,
          src: xmlNode.getAttribute('src') || '',
          width: xmlNode.getAttribute('width')
            ? parseInt(xmlNode.getAttribute('width') as string, 10)
            : undefined,
        });
      } else {
        return INodeHelper.createElementNode(ImageNode.getType(), {
          altText: xmlNode.getAttribute('alt') || '',
          maxWidth: xmlNode.getAttribute('max-width')
            ? parseInt(xmlNode.getAttribute('max-width') as string, 10)
            : undefined,
          src: xmlNode.getAttribute('src') || '',
          width: xmlNode.getAttribute('width')
            ? parseInt(xmlNode.getAttribute('width') as string, 10)
            : undefined,
        });
      }
    });
  }

  private registerMarkdown() {
    const markdownService = this.kernel.requireService(IMarkdownShortCutService);
    if (!markdownService) {
      return;
    }
    markdownService.registerMarkdownWriter(ImageNode.getType(), (ctx, node) => {
      if ($isImageNode(node)) {
        ctx.appendLine(`![${node.altText}](${node.src})`);
      }
    });
    markdownService.registerMarkdownWriter(BlockImageNode.getType(), (ctx, node) => {
      if ($isBlockImageNode(node)) {
        ctx.appendLine(`![${node.altText}](${node.src})\n\n`);
      }
    });

    markdownService.registerMarkdownReader('image', (node) => {
      const altText = node.alt;
      const src = node.url;
      return INodeHelper.createTypeNode(ImageNode.getType(), {
        altText,
        showCaption: false,
        src,
        version: 1,
      });
    });
  }

  private getImageWidth(file: File): Promise<number> {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.addEventListener('load', (e) => {
        const img = new Image();
        img.addEventListener('load', () => {
          resolve(img.naturalWidth);
        });
        img.addEventListener('error', () => {
          // Default width if image fails to load
          resolve(800);
        });
        img.src = e.target?.result as string;
      });
      reader.addEventListener('error', () => {
        // Default width if file reading fails
        resolve(800);
      });
      reader.readAsDataURL(file);
    });
  }
};
