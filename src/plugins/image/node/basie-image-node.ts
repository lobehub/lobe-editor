import type {
  DOMExportOutput,
  EditorConfig,
  LexicalUpdateJSON,
  NodeKey,
  SerializedLexicalNode,
  Spread,
} from 'lexical';
import { DecoratorNode } from 'lexical';

import type { MediaDisplaySize } from '@/utils/mediaDisplaySize';
import { sanitizeMediaDisplayWidth } from '@/utils/mediaDisplaySize';

import {
  normalizeImageCaption,
  sanitizeImageAccent,
  sanitizeImageNaturalSize,
  sanitizeImageThumbhash,
} from '../utils/meta';

export interface ImageMeta {
  accent?: string;
  caption?: string;
  displayWidth?: number;
  naturalHeight?: number;
  naturalWidth?: number;
  thumbhash?: string;
}

export interface ImagePayload extends ImageMeta {
  altText: string;
  height?: number;
  key?: NodeKey;
  maxWidth?: number;
  src: string;
  status?: 'uploaded' | 'loading' | 'error';
  width?: number;
}

export type SerializedImageNode = Spread<
  {
    accent?: string;
    altText: string;
    caption?: string;
    displayWidth?: number;
    height?: number;
    maxWidth: number;
    naturalHeight?: number;
    naturalWidth?: number;
    src: string;
    status?: 'uploaded' | 'loading' | 'error';
    thumbhash?: string;
    width?: number;
  },
  SerializedLexicalNode
>;

export class BaseImageNode extends DecoratorNode<any> {
  __src: string;
  __altText: string;
  __width: 'inherit' | number;
  __height: 'inherit' | number;
  __maxWidth: number;
  __caption: string;
  __thumbhash: string | undefined;
  __accent: string | undefined;
  __displayWidth: number | undefined;
  __naturalWidth: number | undefined;
  __naturalHeight: number | undefined;

  static clone(node: BaseImageNode): BaseImageNode {
    return new BaseImageNode(
      node.__src,
      node.__altText,
      node.__maxWidth,
      node.__width,
      node.__height,
      node.__key,
      node.getMeta(),
    );
  }

  static importJSON(serializedNode: SerializedImageNode): BaseImageNode {
    const {
      altText,
      height,
      width,
      maxWidth,
      src,
      caption,
      thumbhash,
      accent,
      displayWidth,
      naturalHeight,
      naturalWidth,
    } = serializedNode;

    return new BaseImageNode(src, altText, maxWidth, width, height, undefined, {
      accent,
      caption,
      displayWidth,
      naturalHeight,
      naturalWidth,
      thumbhash,
    });
  }

  static getType(): string {
    return 'image';
  }

  updateFromJSON(serializedNode: LexicalUpdateJSON<SerializedImageNode>): this {
    const node = super.updateFromJSON(serializedNode);
    return node;
  }

  exportDOM(): DOMExportOutput {
    const element = document.createElement('img');
    element.setAttribute('src', this.__src);
    element.setAttribute('alt', this.__altText);
    element.setAttribute('width', this.__width.toString());
    element.setAttribute('height', this.__height.toString());
    return { element };
  }

  constructor(
    src: string,
    altText: string,
    maxWidth: number,
    width?: 'inherit' | number,
    height?: 'inherit' | number,
    key?: NodeKey,
    meta?: ImageMeta,
  ) {
    super(key);
    this.__src = src;
    this.__altText = altText;
    this.__maxWidth = maxWidth;
    this.__width = width || 'inherit';
    this.__height = height || 'inherit';
    this.__caption = normalizeImageCaption(meta?.caption);
    this.__thumbhash = sanitizeImageThumbhash(meta?.thumbhash);
    this.__accent = sanitizeImageAccent(meta?.accent);
    this.__displayWidth = sanitizeMediaDisplayWidth(meta?.displayWidth);
    const natural = sanitizeImageNaturalSize(meta?.naturalWidth, meta?.naturalHeight);
    this.__naturalWidth = natural?.naturalWidth;
    this.__naturalHeight = natural?.naturalHeight;
  }

  exportJSON(): SerializedImageNode {
    const json: SerializedImageNode = {
      ...super.exportJSON(),
      altText: this.getAltText(),
      height: this.__height === 'inherit' ? 0 : this.__height,
      maxWidth: this.__maxWidth,
      src: this.getSrc(),
      width: this.__width === 'inherit' ? 0 : this.__width,
    };
    if (this.__caption) json.caption = this.__caption;
    if (this.__thumbhash) json.thumbhash = this.__thumbhash;
    if (this.__accent) json.accent = this.__accent;
    if (this.__displayWidth !== undefined) json.displayWidth = this.__displayWidth;
    if (this.__naturalWidth !== undefined && this.__naturalHeight !== undefined) {
      json.naturalWidth = this.__naturalWidth;
      json.naturalHeight = this.__naturalHeight;
    }
    return json;
  }

  get caption(): string {
    return this.__caption;
  }

  get thumbhash(): string | undefined {
    return this.__thumbhash;
  }

  get accent(): string | undefined {
    return this.__accent;
  }

  get displayWidth(): number | undefined {
    return this.__displayWidth;
  }

  get naturalWidth(): number | undefined {
    return this.__naturalWidth;
  }

  get naturalHeight(): number | undefined {
    return this.__naturalHeight;
  }

  getMeta(): ImageMeta {
    return {
      accent: this.__accent,
      caption: this.__caption,
      displayWidth: this.__displayWidth,
      naturalHeight: this.__naturalHeight,
      naturalWidth: this.__naturalWidth,
      thumbhash: this.__thumbhash,
    };
  }

  setNaturalSize(width: number, height: number): void {
    const natural = sanitizeImageNaturalSize(width, height);
    if (!natural) return;
    const writable = this.getWritable();
    writable.__naturalWidth = natural.naturalWidth;
    writable.__naturalHeight = natural.naturalHeight;
  }

  setDisplaySize(size: MediaDisplaySize, naturalWidth?: number): void {
    const writable = this.getWritable();
    switch (size.mode) {
      case 'percent': {
        writable.__displayWidth = sanitizeMediaDisplayWidth(size.value);
        writable.__width = 'inherit';
        break;
      }
      case 'px': {
        writable.__displayWidth = undefined;
        writable.__width = size.px;
        writable.__maxWidth = size.px;
        break;
      }
      default: {
        writable.__displayWidth = undefined;
        writable.__width = 'inherit';
        if (naturalWidth) writable.__maxWidth = naturalWidth;
      }
    }
  }

  setCaption(caption: string): void {
    const writable = this.getWritable();
    writable.__caption = caption;
  }

  setThumbhash(thumbhash: string | undefined): void {
    const writable = this.getWritable();
    writable.__thumbhash = sanitizeImageThumbhash(thumbhash);
  }

  setAccent(accent: string | undefined): void {
    const writable = this.getWritable();
    writable.__accent = sanitizeImageAccent(accent);
  }

  setWidthAndHeight(width: 'inherit' | number, height: 'inherit' | number): void {
    const writable = this.getWritable();
    writable.__width = width;
    writable.__height = height;
  }

  override isInline(): boolean {
    return true;
  }

  // View

  createDOM(config: EditorConfig): HTMLElement {
    const span = document.createElement('span');
    const theme = config.theme;
    const className = theme.image;
    if (className !== undefined) {
      span.className = className;
    }
    return span;
  }

  updateDOM(): false {
    return false;
  }

  getSrc(): string {
    return this.__src;
  }

  getAltText(): string {
    return this.__altText;
  }
}
