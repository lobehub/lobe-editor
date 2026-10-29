import type { LexicalEditor } from 'lexical';

import type { INode } from '@/editor-kernel/inode';
import { INodeHelper } from '@/editor-kernel/inode/helper';
import { KernelPlugin } from '@/editor-kernel/plugin';
import { INodeService } from '@/plugins/inode';
import { ILitexmlService } from '@/plugins/litexml';
import { IMarkdownShortCutService } from '@/plugins/markdown/service/shortcut';
import { IUploadService, UPLOAD_PRIORITY_HIGH } from '@/plugins/upload';
import type { IEditorKernel, IEditorPlugin, IEditorPluginConstructor } from '@/types';

import { INSERT_IMAGE_COMMAND, registerImageCommand } from '../command';
import { $isBlockImageNode, BlockImageNode } from '../node/block-image-node';
import { $isImageNode, ImageNode } from '../node/image-node';

function toMarkdownImage(node: ImageNode | BlockImageNode) {
  if (!node.caption) return `![${node.altText}](${node.src})`;
  const title = node.caption.replaceAll('\\', '\\\\').replaceAll('"', '\\"');
  return `![${node.altText}](${node.src} "${title}")`;
}

function writeImageMetaAttributes(
  node: ImageNode | BlockImageNode,
  attributes: { [key: string]: string },
) {
  if (node.caption) {
    attributes.caption = node.caption;
  }
  if (node.thumbhash) {
    attributes.thumbhash = node.thumbhash;
  }
  if (node.accent) {
    attributes.accent = node.accent;
  }
  if (node.displayWidth !== undefined) {
    attributes['display-width'] = String(node.displayWidth);
  }
}

function readImageAttributes(xmlNode: Element) {
  const maxWidth = xmlNode.getAttribute('max-width');
  const width = xmlNode.getAttribute('width');
  const displayWidth = xmlNode.getAttribute('display-width');
  return {
    accent: xmlNode.getAttribute('accent') || undefined,
    altText: xmlNode.getAttribute('alt') || '',
    caption: xmlNode.getAttribute('caption') || '',
    displayWidth: displayWidth ? parseInt(displayWidth, 10) : undefined,
    maxWidth: maxWidth ? parseInt(maxWidth, 10) : undefined,
    src: xmlNode.getAttribute('src') || '',
    thumbhash: xmlNode.getAttribute('thumbhash') || undefined,
    width: width ? parseInt(width, 10) : undefined,
  };
}

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
    if (this.config?.handleUpload) {
      this.register(
        registerImageCommand(
          editor,
          this.config.handleUpload,
          this.config?.defaultBlockImage !== false,
        ),
      );
    }

    this.registerMarkdown();
    this.registerLiteXml();
    this.registerINode();
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
        writeImageMetaAttributes(node, attributes);
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
        writeImageMetaAttributes(node, attributes);
        return ctx.createXmlNode('img', attributes);
      }
      return false;
    });
    litexmlService.registerXMLReader('img', (xmlNode) => {
      const isBlock =
        this.config?.defaultBlockImage !== false || xmlNode.getAttribute('block') === 'true';
      return INodeHelper.createElementNode(
        isBlock ? BlockImageNode.getType() : ImageNode.getType(),
        readImageAttributes(xmlNode),
      );
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
        ctx.appendLine(toMarkdownImage(node));
      }
    });
    markdownService.registerMarkdownWriter(BlockImageNode.getType(), (ctx, node) => {
      if ($isBlockImageNode(node)) {
        ctx.appendLine(`${toMarkdownImage(node)}\n\n`);
      }
    });

    markdownService.registerMarkdownReader('image', (node) => {
      const altText = node.alt;
      const src = node.url;
      return INodeHelper.createTypeNode(
        defaultBlockImage ? BlockImageNode.getType() : ImageNode.getType(),
        {
          altText,
          caption: node.title || '',
          src,
          version: 1,
        },
      );
    });
  }

  private registerINode() {
    const service = this.kernel.requireService(INodeService);
    if (!service) {
      return;
    }

    service.registerProcessNodeTree(({ root }) => {
      // Process the root node
      const loopNodes = (node: INode) => {
        if ('children' in node && Array.isArray(node.children)) {
          if (
            node.type === 'paragraph' &&
            node.children.length === 1 &&
            node.children[0].type === BlockImageNode.getType()
          ) {
            return node.children[0];
          }
          node.children = node.children.map((child) => {
            return loopNodes(child);
          });
        }
        return node;
      };
      root.children = root.children.map((child) => {
        return loopNodes(child);
      });
    });
  }
};
