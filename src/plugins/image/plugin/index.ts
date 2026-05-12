import { $wrapNodeInElement } from '@lexical/utils';
import {
  $createParagraphNode,
  $getSelection,
  $insertNodes,
  $isRangeSelection,
  $isRootOrShadowRoot,
  COMMAND_PRIORITY_NORMAL,
  LexicalEditor,
  PASTE_COMMAND,
} from 'lexical';
import type { JSX } from 'react';

import { INode } from '@/editor-kernel/inode';
import { INodeHelper } from '@/editor-kernel/inode/helper';
import { KernelPlugin } from '@/editor-kernel/plugin';
import { INodeService } from '@/plugins/inode';
import { IMarkdownShortCutService } from '@/plugins/markdown/service/shortcut';
import { IUploadService, UPLOAD_PRIORITY_HIGH } from '@/plugins/upload';
import { IEditorKernel, IEditorPlugin, IEditorPluginConstructor } from '@/types';
import { createDebugLogger } from '@/utils/debug';

import { INSERT_IMAGE_COMMAND, registerImageCommand } from '../command';
import { $createBlockImageNode, $isBlockImageNode, BlockImageNode } from '../node/block-image-node';
import { $createImageNode, $isImageNode, ImageNode } from '../node/image-node';

export interface ImagePluginOptions {
  defaultBlockImage?: boolean;
  handleRehost?: (url: string) => Promise<{ url: string }>;
  handleUpload: (file: File) => Promise<{ url: string }>;
  needRehost?: (url: string) => boolean;
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
  private logger = createDebugLogger('plugin', 'image');

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
      registerImageCommand(
        editor,
        this.config!.handleUpload,
        this.config?.defaultBlockImage !== false,
      ),
    );

    this.registerMarkdown();
    this.registerINode();
    this.registerUpload(editor);
    this.registerImageUrlPaste(editor);
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

    uploadService.registerUpload(async (file: File, from: string, range?: Range | null) => {
      // Get image dimensions before uploading
      const imageWidth = await this.getImageWidth(file);

      return editor.dispatchCommand(INSERT_IMAGE_COMMAND, {
        block: this.config?.defaultBlockImage !== false,
        file,
        maxWidth: imageWidth,
        range,
      });
    }, UPLOAD_PRIORITY_HIGH);
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

    markdownService.registerMarkdownShortCut({
      regExp: /!\[([^\]]*)]\(([^)]*)\)/,
      replace: (node, match) => {
        const [, altText, src] = match;
        const imageNode = defaultBlockImage
          ? $createBlockImageNode({ altText, src, status: 'uploaded' })
          : $createImageNode({ altText, src, status: 'uploaded' });
        if (defaultBlockImage) {
          // For block images: lift the image out of the paragraph to root level
          const parent = node.getParent();
          if (parent && $isRootOrShadowRoot(parent.getParent())) {
            // Replace the entire paragraph with the image at root level
            const emptyPara = $createParagraphNode();
            parent.replace(imageNode);
            imageNode.insertAfter(emptyPara);
            emptyPara.selectEnd();
          } else {
            // Fallback: just replace the text node
            node.replace(imageNode);
          }
        } else {
          node.replace(imageNode);
          if ($isRootOrShadowRoot(imageNode.getParentOrThrow())) {
            $wrapNodeInElement(imageNode, $createParagraphNode).selectEnd();
          }
        }
      },
      trigger: ')',
      type: 'text-match',
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

  /**
   * Handle pasting image URLs — create ImageNode instead of LinkNode
   */
  private registerImageUrlPaste(editor: LexicalEditor) {
    this.register(
      editor.registerCommand(
        PASTE_COMMAND,
        (payload: ClipboardEvent) => {
          const { clipboardData } = payload;
          if (
            clipboardData &&
            clipboardData.types &&
            clipboardData.types.length === 1 &&
            clipboardData.types[0] === 'text/plain'
          ) {
            const data = clipboardData.getData('text/plain').trim();
            // Check if URL ends in a common image extension
            if (/^https?:\/\/\S+\.(?:jpe?g|png|gif|webp|svg|bmp|ico)(?:\?\S*)?$/i.test(data)) {
              payload.stopImmediatePropagation();
              payload.preventDefault();
              this.logger.debug('Pasting image URL:', data);

              editor.update(() => {
                const selection = $getSelection();
                if ($isRangeSelection(selection)) {
                  const isBlock = this.config?.defaultBlockImage !== false;
                  const imageNode = isBlock
                    ? $createBlockImageNode({ altText: '', src: data, status: 'uploaded' })
                    : $createImageNode({ altText: '', src: data, status: 'uploaded' });
                  $insertNodes([imageNode]);
                  if (!isBlock && $isRootOrShadowRoot(imageNode.getParentOrThrow())) {
                    $wrapNodeInElement(imageNode, $createParagraphNode).selectEnd();
                  } else if (isBlock) {
                    const emptyPara = $createParagraphNode();
                    imageNode.insertAfter(emptyPara);
                    emptyPara.selectEnd();
                  }
                }
              });

              return true;
            }
          }
          return false;
        },
        COMMAND_PRIORITY_NORMAL,
      ),
    );
  }
};
