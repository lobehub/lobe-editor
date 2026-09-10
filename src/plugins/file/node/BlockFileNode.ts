import { addClassNamesToElement } from '@lexical/utils';
import type {
  DOMConversionMap,
  DOMConversionOutput,
  DOMExportOutput,
  EditorConfig,
  LexicalEditor,
  LexicalNode,
  NodeKey,
} from 'lexical';
import { $applyNodeReplacement } from 'lexical';

import { getKernelFromEditor } from '@/editor-kernel/utils';

import type { SerializedFileNode } from './FileNode';
import { FileNode } from './FileNode';

export type SerializedBlockFileNode = SerializedFileNode;

/** A standalone file attachment. The legacy `file` node remains inline. */
export class BlockFileNode extends FileNode {
  static getType(): string {
    return 'block-file';
  }

  static clone(node: BlockFileNode): BlockFileNode {
    return new BlockFileNode(
      node.__name,
      node.__fileUrl,
      node.__size,
      node.__status,
      node.__message,
      node.__key,
    );
  }

  static importJSON(serializedNode: SerializedFileNode): BlockFileNode {
    return $createBlockFileNode(
      serializedNode.name,
      serializedNode.fileUrl,
      serializedNode.size,
      serializedNode.status,
      serializedNode.message,
    ).updateFromJSON(serializedNode);
  }

  static importDOM(): DOMConversionMap | null {
    const convertBlockFile = (node: HTMLElement) => {
      if (node.dataset.blockFile !== 'true') return null;
      return { conversion: $convertBlockFileElement, priority: 2 as const };
    };

    return {
      div: convertBlockFile,
      span: convertBlockFile,
    };
  }

  override isInline(): false {
    return false;
  }

  override exportDOM(): DOMExportOutput {
    const element = document.createElement('div');
    applyBlockFileDOMAttributes(element, this);
    return { element };
  }

  override createDOM(config: EditorConfig): HTMLElement {
    const element = document.createElement('div');
    addClassNamesToElement(element, config.theme.file);
    applyBlockFileDOMAttributes(element, this);
    return element;
  }

  override updateDOM(_previousNode: BlockFileNode, dom: HTMLElement): false {
    applyBlockFileDOMAttributes(dom, this);
    return false;
  }

  override decorate(editor: LexicalEditor): any {
    const decorator =
      getKernelFromEditor(editor)?.getDecorator(BlockFileNode.getType()) ??
      getKernelFromEditor(editor)?.getDecorator(FileNode.getType());
    if (!decorator) return null;
    if (typeof decorator === 'function') return decorator(this, editor);
    return {
      queryDOM: decorator.queryDOM,
      render: decorator.render(this, editor),
    };
  }
}

export function $createBlockFileNode(
  name: string = 'unknown',
  fileUrl?: string,
  size?: number,
  status?: 'pending' | 'uploaded' | 'error',
  message?: string,
  key?: NodeKey,
): BlockFileNode {
  return $applyNodeReplacement(new BlockFileNode(name, fileUrl, size, status, message, key));
}

function $convertBlockFileElement(element: HTMLElement): DOMConversionOutput {
  const size = element.dataset.fileSize ? Number(element.dataset.fileSize) : undefined;
  const parsedSize = size !== undefined && Number.isFinite(size) ? size : undefined;
  const status = element.dataset.fileStatus as 'pending' | 'uploaded' | 'error' | undefined;
  return {
    node: $createBlockFileNode(
      element.dataset.fileName || 'unknown',
      element.dataset.fileUrl || undefined,
      parsedSize,
      status,
      element.dataset.fileMessage || undefined,
    ),
  };
}

const applyBlockFileDOMAttributes = (element: HTMLElement, node: BlockFileNode): void => {
  element.dataset.blockFile = 'true';
  element.dataset.fileName = node.name;
  if (node.fileUrl) element.dataset.fileUrl = node.fileUrl;
  else delete element.dataset.fileUrl;
  if (node.size !== undefined) element.dataset.fileSize = String(node.size);
  else delete element.dataset.fileSize;
  element.dataset.fileStatus = node.status;
  if (node.message) element.dataset.fileMessage = node.message;
  else delete element.dataset.fileMessage;
};

export function $isBlockFileNode(node: LexicalNode): node is BlockFileNode {
  return node.getType() === BlockFileNode.getType();
}
