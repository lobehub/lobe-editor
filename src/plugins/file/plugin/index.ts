import { $wrapNodeInElement } from '@lexical/utils';
import {
  $createParagraphNode,
  $createRangeSelection,
  $insertNodes,
  $isRootOrShadowRoot,
  $setSelection,
  DecoratorNode,
  LexicalEditor,
} from 'lexical';

import { KernelPlugin } from '@/editor-kernel/plugin';
import { ILitexmlService } from '@/plugins/litexml';
import { IMarkdownShortCutService } from '@/plugins/markdown/service/shortcut';
import { IUploadService } from '@/plugins/upload';
import { IEditorKernel, IEditorPlugin, IEditorPluginConstructor } from '@/types';
import { createDebugLogger } from '@/utils/debug';

import { registerFileCommand } from '../command';
import { $createFileNode, $isFileNode, FileNode } from '../node/FileNode';
import { registerFileNodeSelectionObserver } from '../utils';

// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface FilePluginOptions {
  decorator: (node: FileNode, editor: LexicalEditor) => any;
  handleUpload: (file: File) => Promise<{ url: string }>;
  markdownWriter?: (file: FileNode) => string;
  theme?: {
    file?: string;
  };
}

export const FilePlugin: IEditorPluginConstructor<FilePluginOptions> = class
  extends KernelPlugin
  implements IEditorPlugin<FilePluginOptions>
{
  static pluginName = 'FilePlugin';
  private logger = createDebugLogger('plugin', 'file');

  constructor(
    protected kernel: IEditorKernel,
    public config?: FilePluginOptions,
  ) {
    super();
    // Register the file node
    kernel.registerNodes([FileNode]);
    if (config?.theme) {
      kernel.registerThemes(config?.theme);
    }
    this.registerDecorator(
      kernel,
      FileNode.getType(),
      (node: DecoratorNode<any>, editor: LexicalEditor) => {
        return config?.decorator ? config.decorator(node as FileNode, editor) : null;
      },
    );
  }

  onInit(editor: LexicalEditor): void {
    // Register the upload handler if provided
    this.kernel
      .requireService(IUploadService)
      ?.registerUpload(async (file: File, from: string, range: Range | null | undefined) => {
        editor.update(() => {
          if (range) {
            const rangeSelection = $createRangeSelection();
            if (range !== null && range !== undefined) {
              rangeSelection.applyDOMRange(range);
            }
            $setSelection(rangeSelection);
          }
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
              this.logger.error('File upload failed:', error);
              editor.update(() => {
                fileNode.setError('File upload failed : ' + error.message);
              });
            });
        });
        return null;
      });

    this.register(registerFileCommand(editor, this.config!.handleUpload));
    this.register(registerFileNodeSelectionObserver(editor));
    this.registerLiteXml();
    this.registerMarkdownWriter();
  }

  registerLiteXml() {
    const litexmlService = this.kernel.requireService(ILitexmlService);
    if (!litexmlService) {
      return;
    }

    litexmlService.registerXMLWriter(FileNode.getType(), (node, ctx) => {
      if ($isFileNode(node)) {
        return ctx.createXmlNode('file', {
          fileUrl: node.fileUrl || '',
          name: node.name,
        });
      }
      return false;
    });
  }

  registerMarkdownWriter() {
    const markdownService = this.kernel.requireService(IMarkdownShortCutService);
    if (!markdownService) {
      return;
    }
    markdownService.registerMarkdownWriter(FileNode.getType(), (ctx, node) => {
      if ($isFileNode(node)) {
        if (this.config?.markdownWriter) {
          ctx.appendLine(this.config.markdownWriter(node));
          return;
        }
        if (node.status === 'pending') {
          ctx.appendLine(`Uploading ${node.name}...`);
        } else if (node.status === 'error') {
          ctx.appendLine(`Failed to upload ${node.name}: ${node.message}`);
        } else {
          ctx.appendLine(`[${node.name}](${node.fileUrl})`);
        }
      }
    });
  }
};
