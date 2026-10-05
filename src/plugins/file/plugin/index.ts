import { $wrapNodeInElement } from '@lexical/utils';
import type { DecoratorNode, LexicalEditor } from 'lexical';
import {
  $createParagraphNode,
  $createRangeSelection,
  $getSelection,
  $insertNodes,
  $isRootOrShadowRoot,
  $setSelection,
} from 'lexical';

import { INodeHelper } from '@/editor-kernel/inode/helper';
import { KernelPlugin } from '@/editor-kernel/plugin';
import { createEditorAsyncScope } from '@/plugins/common/service/editor-async-scope';
import { IHoleService } from '@/plugins/common/service/i-hole-service';
import { ILitexmlService, type IWriterContext } from '@/plugins/litexml/service/litexml-service';
import {
  IMarkdownShortCutService,
  type IMarkdownWriterContext,
} from '@/plugins/markdown/service/shortcut';
import { IUploadService } from '@/plugins/upload/service/i-upload-service';
import type { IEditorKernel, IEditorPlugin, IEditorPluginConstructor } from '@/types';
import { createDebugLogger } from '@/utils/debug';

import { registerFileCommand } from '../command';
import { $createBlockFileNode, $isBlockFileNode, BlockFileNode } from '../node/BlockFileNode';
import { $createFileNode, $isFileNode, FileNode } from '../node/FileNode';
import { registerFileNodeSelectionObserver, settleFileUpload } from '../utils';

export interface FilePluginOptions {
  defaultBlockFile?: boolean;
  decorator?: (node: FileNode | BlockFileNode, editor: LexicalEditor) => any;
  handleUpload?: (file: File) => Promise<{ url: string }>;
  markdownWriter?: (file: FileNode | BlockFileNode) => string;
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
    kernel.registerNodes([FileNode, BlockFileNode]);
    if (config?.theme) {
      kernel.registerThemes(config?.theme);
    }
    const renderFile = (node: DecoratorNode<any>, editor: LexicalEditor) =>
      config?.decorator ? config.decorator(node as FileNode | BlockFileNode, editor) : null;
    this.registerDecorator(kernel, FileNode.getType(), renderFile);
    this.registerDecorator(kernel, BlockFileNode.getType(), renderFile);
  }

  onInit(editor: LexicalEditor): void {
    const handleUpload = this.config?.handleUpload;

    const holeService = this.kernel.requireService(IHoleService);
    if (holeService) {
      this.register(
        holeService.registerTarget(BlockFileNode, {
          serializeTextContent: (node) => ($isBlockFileNode(node) ? node.name : undefined),
        }),
      );
    }

    if (handleUpload) {
      const scope = createEditorAsyncScope(editor);
      this.register(() => scope.dispose());
      const uploadService = this.kernel.requireService(IUploadService);
      if (uploadService) {
        const unregisterUpload = uploadService.registerUpload(
          async (file: File, from: string, range: Range | null | undefined) => {
            if (!scope.isActive()) return null;
            editor.update(() => {
              if (!scope.isActive()) return;
              if (range) {
                const rangeSelection = $createRangeSelection();
                if (range !== null && range !== undefined) {
                  rangeSelection.applyDOMRange(range);
                }
                $setSelection(rangeSelection);
              }
              const currentSelection = $getSelection();
              if (currentSelection) holeService?.prepareBoundaryInsertion(currentSelection);
              const fileNode = this.config?.defaultBlockFile
                ? $createBlockFileNode(file.name)
                : $createFileNode(file.name);
              const fileKey = fileNode.getKey();
              $insertNodes([fileNode]); // Insert a zero-width space to ensure the image is not the last child
              if (fileNode.isInline() && $isRootOrShadowRoot(fileNode.getParentOrThrow())) {
                $wrapNodeInElement(fileNode, $createParagraphNode).selectEnd();
              }
              handleUpload(file)
                .then((url) => {
                  settleFileUpload(scope, fileKey, (node) => node.setUploaded(url.url));
                })
                .catch((error) => {
                  this.logger.error('File upload failed:', error);
                  settleFileUpload(scope, fileKey, (node) =>
                    node.setError('File upload failed : ' + error.message),
                  );
                });
            });
            return true;
          },
        );

        this.register(() => {
          unregisterUpload?.();
        });
      }

      this.register(
        registerFileCommand(editor, handleUpload, this.config?.defaultBlockFile === true, scope),
      );
    }

    if (this.config?.decorator) {
      this.register(registerFileNodeSelectionObserver(editor, holeService));
    }

    this.registerLiteXml();
    this.registerMarkdownWriter();
  }

  registerLiteXml() {
    const litexmlService = this.kernel.requireService(ILitexmlService);
    if (!litexmlService) {
      return;
    }

    const writeFile = (node: FileNode | BlockFileNode, ctx: IWriterContext) =>
      ctx.createXmlNode('file', {
        ...(node instanceof BlockFileNode ? { block: 'true' } : {}),
        fileUrl: node.fileUrl || '',
        message: node.message || '',
        name: node.name,
        size: node.size?.toString() || '0',
        status: node.status,
      });
    litexmlService.registerXMLWriter(FileNode.getType(), (node, ctx) => {
      if ($isFileNode(node)) return writeFile(node, ctx);
      return false;
    });
    litexmlService.registerXMLWriter(BlockFileNode.getType(), (node, ctx) => {
      if ($isBlockFileNode(node)) return writeFile(node, ctx);
      return false;
    });

    litexmlService.registerXMLReader('file', (xmlElement: Element) => {
      const name = xmlElement.getAttribute('name') || 'unknown';
      const fileUrl = xmlElement.getAttribute('fileUrl') || '';
      const status = xmlElement.getAttribute('status') as
        'pending' | 'uploaded' | 'error' | undefined;
      const type =
        xmlElement.getAttribute('block') === 'true' ? BlockFileNode.getType() : FileNode.getType();
      return INodeHelper.createTypeNode(type, {
        fileUrl,
        message: xmlElement.getAttribute('message') || '',
        name,
        size: parseInt(xmlElement.getAttribute('size') || '0', 10),
        status,
      });
    });
  }

  registerMarkdownWriter() {
    const markdownService = this.kernel.requireService(IMarkdownShortCutService);
    if (!markdownService) {
      return;
    }
    const writeMarkdown = (
      ctx: IMarkdownWriterContext,
      node: FileNode | BlockFileNode,
      block = false,
    ) => {
      let content: string;
      if (node.status === 'pending') {
        content = `Uploading ${node.name}...`;
      } else if (node.status === 'error') {
        content = `Failed to upload ${node.name}: ${node.message}`;
      } else {
        content = `[${node.name}](${node.fileUrl})`;
      }
      if (this.config?.markdownWriter) content = this.config.markdownWriter(node);
      ctx.appendLine(block ? `${content.replace(/\n+$/, '')}\n\n` : content);
    };
    markdownService.registerMarkdownWriter(FileNode.getType(), (ctx, node) => {
      if ($isFileNode(node)) writeMarkdown(ctx, node);
    });
    markdownService.registerMarkdownWriter(BlockFileNode.getType(), (ctx, node) => {
      if ($isBlockFileNode(node)) writeMarkdown(ctx, node, true);
    });
  }
};
