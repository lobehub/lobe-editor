import {
  $applyNodeReplacement,
  DOMConversionMap,
  DOMConversionOutput,
  LexicalNode,
  NodeKey,
} from 'lexical';

import { BaseImageNode, ImagePayload, SerializedImageNode } from './basie-image-node';

export class ImageNode extends BaseImageNode {
  private static _decorate: (node: ImageNode) => any | null = () => null;

  static setDecorate(decorate: (node: ImageNode) => any): void {
    ImageNode._decorate = decorate;
  }

  static getType(): string {
    return 'image';
  }

  private __loading = true;
  private __status: 'uploaded' | 'loading' | 'error' = 'uploaded';
  private __message: string | null = null;
  private __extra: Record<string, unknown> | null = null;

  constructor(opt: {
    altText: string;
    height?: 'inherit' | number;
    key?: NodeKey;
    maxWidth: number;
    src: string;
    status?: 'uploaded' | 'loading' | 'error';
    width?: 'inherit' | number;
  }) {
    super(opt.src, opt.altText, opt.maxWidth, opt.width, opt.height, opt.key);
    this.__status = opt.status ?? 'uploaded';
  }

  public get isLoading(): boolean {
    return this.__loading;
  }

  public get status(): 'uploaded' | 'loading' | 'error' {
    return this.__status;
  }

  public get message(): string | null {
    return this.__message;
  }

  public get src(): string {
    return this.__src;
  }

  public get altText(): string {
    return this.__altText;
  }

  public get maxWidth(): number {
    return this.__maxWidth;
  }

  public get width(): number | string {
    return this.__width;
  }

  public get height(): number | string {
    return this.__height;
  }

  public setMaxWidth(maxWidth: number): void {
    const writable = this.getWritable();
    writable.__maxWidth = maxWidth;
  }

  public setStatus(status: 'uploaded' | 'loading' | 'error'): void {
    const writable = this.getWritable();
    writable.__status = status;
  }

  public setWidth(width: number): void {
    const writable = this.getWritable();
    writable.__width = width;
  }

  public setUploaded(url: string): void {
    const writable = this.getWritable();
    writable.__loading = false;
    writable.__src = url;
    writable.__status = 'uploaded';
  }

  public setError(message: string): void {
    const writable = this.getWritable();
    writable.__loading = false;
    writable.__status = 'error';
    writable.__message = message;
  }

  static clone(node: ImageNode): ImageNode {
    return new ImageNode({
      altText: node.__altText,
      height: node.__height,
      key: node.__key,
      maxWidth: node.__maxWidth,
      src: node.__src,
      status: node.__status,
      width: node.__width,
    });
  }

  static importJSON(serializedNode: SerializedImageNode): ImageNode {
    const { altText, height, width, maxWidth, src, status } = serializedNode;
    // eslint-disable-next-line @typescript-eslint/no-use-before-define
    return $createImageNode({
      altText,
      height,
      maxWidth,
      src,
      status,
      width,
    }).updateFromJSON(serializedNode);
  }

  static importDOM(): DOMConversionMap | null {
    return {
      img: () => ({
        // eslint-disable-next-line @typescript-eslint/no-use-before-define
        conversion: $convertImageElement,
        priority: 0,
      }),
    };
  }

  decorate(): any {
    return ImageNode._decorate(this)!;
  }
}

export function $createImageNode({
  altText,
  height,
  maxWidth = 500,
  src,
  width,
  key,
  status,
}: ImagePayload): ImageNode {
  return $applyNodeReplacement(
    new ImageNode({ altText, height, key, maxWidth, src, status, width }),
  );
}

function $convertImageElement(domNode: Node): null | DOMConversionOutput {
  const img = domNode as HTMLImageElement;
  if (img.src.startsWith('file:///')) {
    return null;
  }
  const { alt: altText, src, width, height } = img;
  const node = $createImageNode({ altText, height, src, width });
  return { node };
}

export function $isImageNode(node: LexicalNode): node is ImageNode {
  return node.getType() === ImageNode.getType();
}
