import type {
  DOMConversionMap,
  DOMConversionOutput,
  DOMExportOutput,
  EditorConfig,
  LexicalEditor,
  LexicalNode,
  NodeKey,
  SerializedLexicalNode,
  Spread,
} from 'lexical';
import { $applyNodeReplacement, DecoratorNode } from 'lexical';

import { getKernelFromEditor } from '@/editor-kernel/utils';
import {
  getMediaDisplayStyle,
  mediaDisplayFieldsFromSize,
  type MediaDisplaySize,
  resolveMediaDisplaySize,
  sanitizeMediaDisplayWidth,
  sanitizeMediaFixedPx,
} from '@/utils/mediaDisplaySize';

import { isSafeVideoSrc, readVideoSizeAttributes } from '../utils/attributes';

export type VideoStatus = 'uploaded' | 'loading' | 'error';

export interface VideoPayload {
  caption?: string;
  displayWidth?: number;
  fixedWidth?: number;
  height?: number;
  key?: NodeKey;
  loop?: boolean;
  message?: string;
  poster?: string;
  src?: string;
  status?: VideoStatus;
  width?: number;
}

export type SerializedVideoNode = Spread<
  {
    caption?: string;
    displayWidth?: number;
    fixedWidth?: number;
    height?: number;
    loop?: boolean;
    poster?: string;
    src: string;
    status?: VideoStatus;
    width?: number;
  },
  SerializedLexicalNode
>;

function optionalString(value: unknown): string | undefined {
  return typeof value === 'string' && value ? value : undefined;
}

export class VideoNode extends DecoratorNode<any> {
  __src: string;
  __poster: string | undefined;
  __caption: string;
  __width: number | undefined;
  __height: number | undefined;
  __displayWidth: number | undefined;
  __fixedWidth: number | undefined;
  __loop: boolean;
  __status: VideoStatus;
  __message: string | undefined;

  static getType(): string {
    return 'video';
  }

  static clone(node: VideoNode): VideoNode {
    return new VideoNode({ ...node.getPayload(), key: node.__key });
  }

  static importJSON(serializedNode: SerializedVideoNode): VideoNode {
    return $createVideoNode({
      caption: serializedNode.caption,
      displayWidth: serializedNode.displayWidth,
      fixedWidth: serializedNode.fixedWidth,
      height: serializedNode.height,
      loop: serializedNode.loop,
      poster: serializedNode.poster,
      src: serializedNode.src,
      status: serializedNode.status,
      width: serializedNode.width,
    }).updateFromJSON(serializedNode);
  }

  static importDOM(): DOMConversionMap | null {
    return {
      figure: (element: HTMLElement) =>
        element.querySelector(':scope > video')
          ? { conversion: $convertFigureElement, priority: 1 }
          : null,
      video: () => ({ conversion: $convertVideoElement, priority: 0 }),
    };
  }

  constructor(payload: VideoPayload = {}) {
    super(payload.key);
    this.__src = isSafeVideoSrc(payload.src) ? payload.src.trim() : '';
    this.__poster = isSafeVideoSrc(payload.poster) ? payload.poster.trim() : undefined;
    this.__caption = payload.caption ?? '';
    this.__width = sanitizeMediaFixedPx(payload.width);
    this.__height = sanitizeMediaFixedPx(payload.height);
    this.__displayWidth = sanitizeMediaDisplayWidth(payload.displayWidth);
    this.__fixedWidth =
      this.__displayWidth === undefined ? sanitizeMediaFixedPx(payload.fixedWidth) : undefined;
    this.__loop = payload.loop === true;
    this.__status = payload.status ?? 'uploaded';
    this.__message = optionalString(payload.message);
  }

  getPayload(): VideoPayload {
    return {
      caption: this.__caption,
      displayWidth: this.__displayWidth,
      fixedWidth: this.__fixedWidth,
      height: this.__height,
      loop: this.__loop,
      message: this.__message,
      poster: this.__poster,
      src: this.__src,
      status: this.__status,
      width: this.__width,
    };
  }

  exportJSON(): SerializedVideoNode {
    const json: SerializedVideoNode = {
      ...super.exportJSON(),
      src: this.__src,
      type: VideoNode.getType(),
      version: 1,
    };
    if (this.__poster) json.poster = this.__poster;
    if (this.__caption) json.caption = this.__caption;
    if (this.__width !== undefined) json.width = this.__width;
    if (this.__height !== undefined) json.height = this.__height;
    if (this.__displayWidth !== undefined) json.displayWidth = this.__displayWidth;
    if (this.__fixedWidth !== undefined) json.fixedWidth = this.__fixedWidth;
    if (this.__loop) json.loop = true;
    if (this.__status !== 'uploaded') json.status = this.__status;
    return json;
  }

  exportDOM(): DOMExportOutput {
    const figure = document.createElement('figure');
    const video = document.createElement('video');
    if (this.__src) video.setAttribute('src', this.__src);
    if (this.__poster) video.setAttribute('poster', this.__poster);
    video.setAttribute('controls', '');
    if (this.__loop) video.setAttribute('loop', '');
    const style = getMediaDisplayStyle(this.getDisplaySize());
    if (style.width) video.style.width = String(style.width);
    figure.append(video);
    if (this.__caption) {
      const caption = document.createElement('figcaption');
      caption.textContent = this.__caption;
      figure.append(caption);
    }
    return { element: figure };
  }

  get src(): string {
    return this.__src;
  }

  get poster(): string | undefined {
    return this.__poster;
  }

  get caption(): string {
    return this.__caption;
  }

  get width(): number | undefined {
    return this.__width;
  }

  get height(): number | undefined {
    return this.__height;
  }

  get displayWidth(): number | undefined {
    return this.__displayWidth;
  }

  get fixedWidth(): number | undefined {
    return this.__fixedWidth;
  }

  get loop(): boolean {
    return this.__loop;
  }

  get status(): VideoStatus {
    return this.__status;
  }

  get message(): string | undefined {
    return this.__message;
  }

  getDisplaySize(): MediaDisplaySize {
    return resolveMediaDisplaySize({
      displayWidth: this.__displayWidth,
      fixedWidth: this.__fixedWidth,
    });
  }

  setDisplaySize(size: MediaDisplaySize): void {
    const writable = this.getWritable();
    const fields = mediaDisplayFieldsFromSize(size);
    writable.__displayWidth = fields.displayWidth;
    writable.__fixedWidth = fields.fixedWidth;
  }

  setCaption(caption: string): void {
    this.getWritable().__caption = caption;
  }

  setPoster(poster: string | undefined): void {
    this.getWritable().__poster = isSafeVideoSrc(poster) ? poster.trim() : undefined;
  }

  setLoop(loop: boolean): void {
    this.getWritable().__loop = loop;
  }

  setIntrinsicSize(width: number, height: number): void {
    const writable = this.getWritable();
    writable.__width = sanitizeMediaFixedPx(width);
    writable.__height = sanitizeMediaFixedPx(height);
  }

  setStatus(status: VideoStatus): void {
    this.getWritable().__status = status;
  }

  setUploaded(src: string): void {
    const writable = this.getWritable();
    writable.__src = isSafeVideoSrc(src) ? src.trim() : '';
    writable.__status = 'uploaded';
    writable.__message = undefined;
  }

  setError(message: string): void {
    const writable = this.getWritable();
    writable.__status = 'error';
    writable.__message = message;
  }

  createDOM(config: EditorConfig): HTMLElement {
    const div = document.createElement('div');
    const className = config.theme.video;
    if (className) div.className = className;
    return div;
  }

  updateDOM(): false {
    return false;
  }

  isInline(): boolean {
    return false;
  }

  getTextContent(): string {
    return '\n';
  }

  decorate(editor: LexicalEditor): any {
    const decorator = getKernelFromEditor(editor)?.getDecorator(VideoNode.getType());
    if (!decorator) return null;
    if (typeof decorator === 'function') return decorator(this, editor);
    return { queryDOM: decorator.queryDOM, render: decorator.render(this, editor) };
  }
}

export function $createVideoNode(payload: VideoPayload = {}): VideoNode {
  return $applyNodeReplacement(new VideoNode(payload));
}

export function $isVideoNode(node: LexicalNode | null | undefined): node is VideoNode {
  return node instanceof VideoNode;
}

export function readVideoElement(element: HTMLVideoElement): VideoPayload | null {
  const src =
    element.getAttribute('src') || element.querySelector('source[src]')?.getAttribute('src');
  if (!isSafeVideoSrc(src)) return null;
  return {
    ...readVideoSizeAttributes(element.getAttribute('style'), element.getAttribute('width')),
    loop: element.hasAttribute('loop'),
    poster: element.getAttribute('poster') ?? undefined,
    src,
  };
}

function $convertVideoElement(domNode: HTMLElement): DOMConversionOutput | null {
  const payload = readVideoElement(domNode as HTMLVideoElement);
  return payload ? { node: $createVideoNode(payload) } : null;
}

function $convertFigureElement(domNode: HTMLElement): DOMConversionOutput | null {
  const video = domNode.querySelector<HTMLVideoElement>(':scope > video');
  const payload = video ? readVideoElement(video) : null;
  if (!payload) return null;
  const caption = domNode.querySelector(':scope > figcaption')?.textContent?.trim();
  return {
    forChild: () => null,
    node: $createVideoNode({ ...payload, caption: caption || undefined }),
  };
}
