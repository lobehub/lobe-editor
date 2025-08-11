/* eslint-disable @typescript-eslint/no-use-before-define */
import { addClassNamesToElement } from '@lexical/utils';
import {
  $applyNodeReplacement,
  DOMConversionMap,
  DOMConversionOutput,
  DOMExportOutput,
  DecoratorNode,
  EditorConfig,
  LexicalEditor,
  LexicalNode,
  LexicalUpdateJSON,
  SerializedLexicalNode,
  Spread,
} from 'lexical';

import { getKernelFromEditor } from '@/editor-kernel/utils';

export type SerializedFileNode = Spread<
  {
    fileUrl?: string;
    message?: string;
    name: string;
    size?: number;
    status?: 'pending' | 'uploaded' | 'error';
  },
  SerializedLexicalNode
>;

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
    );
  }

  static importJSON(serializedNode: SerializedFileNode): FileNode {
    return new FileNode(
      serializedNode.name,
      serializedNode.fileUrl,
      serializedNode.size,
      serializedNode.status,
      serializedNode.message,
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

  constructor(
    name: string,
    fileUrl?: string,
    size?: number,
    status?: 'pending' | 'uploaded' | 'error',
    message?: string,
    key?: string,
  ) {
    super(key);
    this.__name = name;
    this.__fileUrl = fileUrl;
    this.__size = size;
    this.__status = status || 'pending';
    this.__message = message;
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
      fileUrl: this.fileUrl,
      message: this.message,
      name: this.name,
      size: this.size,
      status: this.status,
    };
  }

  updateFromJSON(serializedNode: LexicalUpdateJSON<SerializedFileNode>): this {
    const node = super.updateFromJSON(serializedNode);
    console.trace('FileNode updated from JSON', node);
    return node;
  }

  getTextContent(): string {
    return '\n';
  }

  updateDOM(): boolean {
    return false;
  }

  decorate(editor: LexicalEditor): any {
    return getKernelFromEditor(editor)?.getDecorator('file')?.(this, editor) || null;
  }
}

export function $createFileNode(
  name: string = 'unknown',
  fileUrl?: string,
  size?: number,
  status?: 'pending' | 'uploaded' | 'error',
  message?: string,
): FileNode {
  return $applyNodeReplacement(new FileNode(name, fileUrl, size, status, message));
}

function $convertFileElement(): DOMConversionOutput {
  return { node: $createFileNode() };
}

export function $isFileNode(node: LexicalNode): node is FileNode {
  return node.getType() === FileNode.getType();
}
