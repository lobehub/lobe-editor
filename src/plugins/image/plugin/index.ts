import { $wrapNodeInElement } from '@lexical/utils';
import { $createParagraphNode, $insertNodes, $isRootOrShadowRoot, LexicalEditor } from 'lexical';
import { JSX } from 'react';

import { KernelPlugin } from '@/editor-kernel/plugin';
import { IEditorKernel, IEditorPlugin, IEditorPluginConstructor } from '@/editor-kernel/types';
import { IUploadService, UPLOAD_PRIORITY_HIGH } from '@/plugins/upload';

import { $createImageNode, ImageNode } from '../node/image-node';
import './index.less';

export interface ImagePluginOptions {
  // Custom render function for images
  handleUpload: (file: File) => Promise<{ url: string }>;
  renderImage: (node: ImageNode) => JSX.Element | null; // Optional custom upload handler
}

function isImageFile(file: File): boolean {
  return file.type.startsWith('image/');
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
    kernel.registerThemes({
      image: 'editor_image',
    });
  }

  onInit(editor: LexicalEditor): void {
    // Register the upload handler if provided
    this.kernel.requireService(IUploadService)?.registerUpload(async (file: File) => {
      if (!isImageFile(file)) {
        return null; // Not an image file
      }
      const placeholderURL = URL.createObjectURL(file); // Create a local URL for the image
      editor.update(() => {
        const imageNode = $createImageNode({
          altText: file.name,
          src: placeholderURL,
        });
        $insertNodes([imageNode]); // Insert a zero-width space to ensure the image is not the last child
        if ($isRootOrShadowRoot(imageNode.getParentOrThrow())) {
          $wrapNodeInElement(imageNode, $createParagraphNode).selectEnd();
        }
        this.config!.handleUpload(file)
          .then((url) => {
            editor.update(() => {
              imageNode.setUploaded(url.url);
            });
          })
          .catch((error) => {
            console.error('Image upload failed:', error);
            editor.update(() => {
              imageNode.setError('Image upload failed : ' + error.message);
            });
          });
      });
      return true;
    }, UPLOAD_PRIORITY_HIGH);

    this.register(
      editor.registerUpdateListener((payload) => {
        console.trace('ImagePlugin update:', payload);
      }),
    );
  }
};
