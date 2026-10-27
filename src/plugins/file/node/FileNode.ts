import { addClassNamesToElement } from '@lexical/utils';
import type {
  DOMConversionMap,
  DOMConversionOutput,
  DOMExportOutput,
  EditorConfig,
  LexicalEditor,
  LexicalNode,
  LexicalUpdateJSON,
  SerializedLexicalNode,
  Spread,
} from 'lexical';
import { $applyNodeReplacement, DecoratorNode } from 'lexical';

import { getKernelFromEditor } from '@/editor-kernel/utils';

import { getExtensionFromMimeType, getFileExtension } from '../utils/meta';

export type SerializedFileNode = Spread<
  {
    ext?: string;
    fileUrl?: string;
    message?: string;
    mimeType?: string;
    name: string;
    size?: number;
    status?: 'pending' | 'uploaded' | 'error';
  },
  SerializedLexicalNode
>;

export interface FileNodeMeta {
  ext?: string;
  mimeType?: string;
}

export class FileNode extends DecoratorNode<any> {
  static getType(): string {
    return 'file';
  }

  static clone(node: FileNode): FileNode {
    return new FileNode(
      node.__name,
      node.__fileUrl,
      node.__size,
      node.__status,
      node.__message,
      node.__key,
      { ext: node.__ext, mimeType: node.__mimeType },
    );
  }

  static importJSON(serializedNode: SerializedFileNode): FileNode {
    return new FileNode(
      serializedNode.name,
      serializedNode.fileUrl,
      serializedNode.size,
      serializedNode.status,
      serializedNode.message,
      undefined,
      { ext: serializedNode.ext, mimeType: serializedNode.mimeType },
    );
  }

  static importDOM(): DOMConversionMap | null {
    return {
      span: (node) => {
        if (node.classList.contains('file')) {
          return {
            conversion: $convertFileElement,
            priority: 0,
          };
        }
        return null;
      },
    };
  }

  __name: string;
  __fileUrl: string | undefined;
  __size: number | undefined;
  __status: 'pending' | 'uploaded' | 'error';
  __message?: string;
  __mimeType: string | undefined;
  __ext: string | undefined;

  get name(): string {
    return this.__name;
  }

  get fileUrl(): string | undefined {
    return this.__fileUrl;
  }

  get size(): number | undefined {
    return this.__size;
  }

  get status(): 'pending' | 'uploaded' | 'error' {
    return this.__status;
  }

  get message(): string | undefined {
    return this.__message;
  }

  get mimeType(): string | undefined {
    return this.__mimeType;
  }

  get ext(): string | undefined {
    return this.__ext;
  }

  constructor(
    name: string,
    fileUrl?: string,
    size?: number,
    status?: 'pending' | 'uploaded' | 'error',
    message?: string,
    key?: string,
    meta?: FileNodeMeta,
  ) {
    super(key);
    this.__name = name;
    this.__fileUrl = fileUrl;
    this.__size = size;
    this.__status = status || 'pending';
    this.__message = message;
    this.__mimeType = meta?.mimeType || undefined;
    this.__ext =
      meta?.ext?.toLowerCase() ||
      getFileExtension(name) ||
      getExtensionFromMimeType(meta?.mimeType);
  }

  setUploaded(url: string): void {
    const writable = this.getWritable();
    writable.__fileUrl = url;
    writable.__status = 'uploaded';
    writable.__message = undefined; // Clear any previous error message
  }

  setError(message: string): void {
    const writable = this.getWritable();
    writable.__status = 'error';
    writable.__message = message;
  }

  exportDOM(): DOMExportOutput {
    return { element: document.createElement('span') };
  }

  createDOM(config: EditorConfig): HTMLElement {
    const element = document.createElement('span');
    addClassNamesToElement(element, config.theme.file);
    return element;
  }

  exportJSON(): SerializedFileNode {
    return {
      ...super.exportJSON(),
      ext: this.ext,
      fileUrl: this.fileUrl,
      message: this.message,
      mimeType: this.mimeType,
      name: this.name,
      size: this.size,
      status: this.status,
    };
  }

  updateFromJSON(serializedNode: LexicalUpdateJSON<SerializedFileNode>): this {
    const node = super.updateFromJSON(serializedNode);
    return node;
  }

  getTextContent(): string {
    return '\n';
  }

  updateDOM(): boolean {
    return false;
  }

  decorate(editor: LexicalEditor): any {
    const decorator = getKernelFromEditor(editor)?.getDecorator('file');
    if (!decorator) {
      return null;
    }
    if (typeof decorator === 'function') {
      return decorator(this, editor);
    }
    return {
      queryDOM: decorator.queryDOM,
      render: decorator.render(this, editor),
    };
  }
}

export function $createFileNode(
  name: string = 'unknown',
  fileUrl?: string,
  size?: number,
  status?: 'pending' | 'uploaded' | 'error',
  message?: string,
  meta?: FileNodeMeta,
): FileNode {
  return $applyNodeReplacement(new FileNode(name, fileUrl, size, status, message, undefined, meta));
}

function $convertFileElement(): DOMConversionOutput {
  return { node: $createFileNode() };
}

export function $isFileNode(node: LexicalNode): node is FileNode {
  return node.getType() === FileNode.getType();
}
