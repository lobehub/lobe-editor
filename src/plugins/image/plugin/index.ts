import type { LexicalEditor } from 'lexical';

import { INodeHelper } from '@/editor-kernel/inode/helper';
import { KernelPlugin } from '@/editor-kernel/plugin';
import { registerBlockRewriteAdapter } from '@/plugins/block/service/rewrite-adapter';
import { IHoleService } from '@/plugins/common/service/i-hole-service';
import { ILitexmlService } from '@/plugins/litexml/service/litexml-service';
import { IMarkdownShortCutService } from '@/plugins/markdown/service/shortcut';
import { IUploadService, UPLOAD_PRIORITY_HIGH } from '@/plugins/upload/service/i-upload-service';
import type { IEditorKernel, IEditorPlugin, IEditorPluginConstructor } from '@/types';

import { INSERT_IMAGE_COMMAND, registerBlockImageCommand, registerImageCommand } from '../command';
import { $isBlockImageNode, BlockImageNode } from '../node/block-image-node';
import { $isImageNode, ImageNode } from '../node/image-node';
import { blockImageRewriteAdapter } from '../rewrite-adapter';

export interface ImagePluginOptions {
  defaultBlockImage?: boolean;
  getImageWidth?: (file: File) => Promise<number>;
  handleRehost?: (url: string) => Promise<{ url: string }>;
  handleUpload?: (file: File) => Promise<{ url: string }>;
  needRehost?: (url: string) => boolean;
  renderImage?: (node: ImageNode | BlockImageNode) => unknown;
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
    ImageNode.setDecorate(config?.renderImage ?? (() => null));
    BlockImageNode.setDecorate(config?.renderImage ?? (() => null));
    if (config?.theme) {
      kernel.registerThemes(config.theme);
    }
  }

  onInit(editor: LexicalEditor): void {
    const holeService = this.kernel.requireService(IHoleService);
    if (holeService) this.register(holeService.registerTarget(BlockImageNode));
    if (this.config?.handleUpload) {
      this.register(
        registerImageCommand(
          editor,
          this.config.handleUpload,
          this.config?.defaultBlockImage !== false,
        ),
      );
    }
    this.register(registerBlockImageCommand(editor));

    this.registerMarkdown();
    this.registerLiteXml();
    this.register(registerBlockRewriteAdapter(this.kernel, blockImageRewriteAdapter));
    this.registerUpload(editor);
    if (this.config?.needRehost && this.config?.handleRehost) {
      const needRehost = this.config.needRehost;
      const handleRehost = this.config.handleRehost;
      this.register(
        editor.registerNodeTransform(ImageNode, (node) => {
          if (node.status === 'uploaded' && needRehost(node.src)) {
            node.setStatus('loading');
            handleRehost(node.src)
              .then(({ url }) => {
                editor.update(() => {
                  node.setUploaded(url);
                });
              })
              .catch(() => {
                editor.update(() => {
                  node.setError('Rehost failed');
                });
              });
          }
        }),
      );
      this.register(
        editor.registerNodeTransform(BlockImageNode, (node) => {
          if (node.status === 'uploaded' && needRehost(node.src)) {
            node.setStatus('loading');
            handleRehost(node.src)
              .then(({ url }) => {
                editor.update(() => {
                  node.setUploaded(url);
                });
              })
              .catch(() => {
                editor.update(() => {
                  node.setError('Rehost failed');
                });
              });
          }
        }),
      );
    }
  }

  private registerUpload(editor: LexicalEditor) {
    const uploadService = this.kernel.requireService(IUploadService);
    if (!uploadService) {
      return;
    }
    if (!this.config?.handleUpload) {
      return;
    }

    uploadService.registerUpload(async (file: File, from: string, range?: Range | null) => {
      const imageWidth = await this.config?.getImageWidth?.(file);

      return editor.dispatchCommand(INSERT_IMAGE_COMMAND, {
        block: this.config?.defaultBlockImage !== false,
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
      if (this.config?.defaultBlockImage !== false) {
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
      }
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
    const defaultBlockImage = this.config?.defaultBlockImage !== false;
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
      return INodeHelper.createTypeNode(
        defaultBlockImage ? BlockImageNode.getType() : ImageNode.getType(),
        {
          altText,
          showCaption: false,
          src,
          version: 1,
        },
      );
    });
  }
};
