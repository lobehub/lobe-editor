import { $wrapNodeInElement } from '@lexical/utils';
import {
  $createParagraphNode,
  $insertNodes,
  $isRootOrShadowRoot,
  DecoratorNode,
  LexicalEditor,
} from 'lexical';

import { IEditorPlugin } from '@/editor-kernel';
import { KernelPlugin } from '@/editor-kernel/plugin';
import { IEditorKernel, IEditorPluginConstructor } from '@/editor-kernel/types';
import { IUploadService } from '@/plugins/upload';

import { registerFileCommand } from '../command';
import { $createFileNode, FileNode } from '../node/FileNode';
import { registerFileNodeSelectionObserver } from '../utils';

// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface FilePluginOptions {
  decorator: (node: FileNode, editor: LexicalEditor) => any;
  handleUpload: (file: File) => Promise<{ url: string }>;
}

export const FilePlugin: IEditorPluginConstructor<FilePluginOptions> = class
  extends KernelPlugin
  implements IEditorPlugin<FilePluginOptions>
{
  static pluginName = 'FilePlugin';

  constructor(
    protected kernel: IEditorKernel,
    public config?: FilePluginOptions,
  ) {
    super();
    // Register the file node
    kernel.registerNodes([FileNode]);
    kernel.registerThemes({
      file: 'editor_file',
    });
    kernel.registerDecorator('file', (node: DecoratorNode<any>, editor: LexicalEditor) => {
      return config?.decorator ? config.decorator(node as FileNode, editor) : null;
    });
  }

  onInit(editor: LexicalEditor): void {
    // Register the upload handler if provided
    this.kernel.requireService(IUploadService)?.registerUpload(async (file: File) => {
      editor.update(() => {
        const fileNode = $createFileNode(file.name);
        $insertNodes([fileNode]); // Insert a zero-width space to ensure the image is not the last child
        if ($isRootOrShadowRoot(fileNode.getParentOrThrow())) {
          $wrapNodeInElement(fileNode, $createParagraphNode).selectEnd();
        }
        this.config!.handleUpload(file)
          .then((url) => {
            editor.update(() => {
              fileNode.setUploaded(url.url);
            });
          })
          .catch((error) => {
            console.error('File upload failed:', error);
            editor.update(() => {
              fileNode.setError('File upload failed : ' + error.message);
            });
          });
      });
      return null;
    });

    this.register(registerFileCommand(editor, this.config!.handleUpload));
    this.register(registerFileNodeSelectionObserver(editor));
  }
};
