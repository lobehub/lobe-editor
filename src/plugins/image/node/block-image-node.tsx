import {
  $applyNodeReplacement,
  DOMConversionMap,
  DOMConversionOutput,
  EditorConfig,
  LexicalNode,
  NodeKey,
} from 'lexical';

import { BaseImageNode, ImagePayload, SerializedImageNode } from './basie-image-node';

export class BlockImageNode extends BaseImageNode {
  private static _decorate: (node: BlockImageNode) => any | null = () => null;

  static setDecorate(decorate: (node: BlockImageNode) => any): void {
    BlockImageNode._decorate = decorate;
  }

  static getType(): string {
    return 'block-image';
  }

  private __loading = true;
  private __status: 'uploaded' | 'loading' | 'error' = 'uploaded';
  private __message: string | null = null;
  private __extra: Record<string, unknown> | null = null;

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

  override isInline(): boolean {
    return false;
  }

  public setMaxWidth(maxWidth: number): void {
    const writable = this.getWritable();
    writable.__maxWidth = maxWidth;
  }

  public setWidth(width: number): void {
    const writable = this.getWritable();
    writable.__width = width;
  }

  public setStatus(status: 'uploaded' | 'loading' | 'error'): void {
    const writable = this.getWritable();
    writable.__status = status;
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

  static clone(node: BlockImageNode): BlockImageNode {
    return new BlockImageNode({
      altText: node.__altText,
      height: node.__height,
      key: node.__key,
      maxWidth: node.__maxWidth,
      src: node.__src,
      status: node.__status,
      width: node.__width,
    });
  }

  static importJSON(serializedNode: SerializedImageNode): BlockImageNode {
    const { altText, height, width, maxWidth, src, status } = serializedNode;
    // eslint-disable-next-line @typescript-eslint/no-use-before-define
    return $createBlockImageNode({
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
    return BlockImageNode._decorate(this)!;
  }

  override createDOM(config: EditorConfig): HTMLElement {
    const span = document.createElement('div');
    const theme = config.theme;
    const className = theme.blockImage;
    if (className !== undefined) {
      span.className = className;
    }
    return span;
  }
}

export function $createBlockImageNode({
  altText,
  height,
  maxWidth = 4200,
  src,
  width,
  key,
  status,
}: ImagePayload): BlockImageNode {
  return $applyNodeReplacement(
    new BlockImageNode({ altText, height, key, maxWidth, src, status, width }),
  );
}

function $convertImageElement(domNode: Node): null | DOMConversionOutput {
  const img = domNode as HTMLImageElement;
  if (img.src.startsWith('file:///')) {
    return null;
  }
  const { alt: altText, src, width, height } = img;
  const node = $createBlockImageNode({ altText, height, src, width });
  return { node };
}

export function $isBlockImageNode(node: LexicalNode): node is BlockImageNode {
  return node.getType() === BlockImageNode.getType();
}
