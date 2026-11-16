import type { DecoratorNode, LexicalEditor } from 'lexical';

import type { INode } from '@/editor-kernel/inode';
import { INodeHelper } from '@/editor-kernel/inode/helper';
import { KernelPlugin } from '@/editor-kernel/plugin';
import { INodeService } from '@/plugins/inode';
import { ILitexmlService } from '@/plugins/litexml';
import { IMarkdownShortCutService } from '@/plugins/markdown/service/shortcut';
import { IUploadService, UPLOAD_PRIORITY_HIGH } from '@/plugins/upload';
import type { IEditorKernel, IEditorPlugin, IEditorPluginConstructor } from '@/types';
import { sanitizeMediaDisplayWidth, sanitizeMediaFixedPx } from '@/utils/mediaDisplaySize';

import { INSERT_VIDEO_COMMAND, registerVideoCommand } from '../command';
import { $isVideoNode, type VideoNode, VideoNode as VideoNodeClass } from '../node/VideoNode';
import {
  escapeHtmlAttribute,
  isSafeVideoSrc,
  parseHtmlTagAttributes,
  readVideoSizeAttributes,
} from '../utils/attributes';

const VIDEO_SOURCE_FIELD = '__videoSource';

export interface VideoPluginOptions {
  decorator?: (node: VideoNode, editor: LexicalEditor) => any;
  handleUpload?: (file: File) => Promise<{ url: string }>;
  theme?: {
    video?: string;
  };
}

export function toVideoMarkdown(node: VideoNode): string {
  const attributes = [`src="${escapeHtmlAttribute(node.src)}"`];
  if (node.poster) attributes.push(`poster="${escapeHtmlAttribute(node.poster)}"`);
  if (node.caption) attributes.push(`title="${escapeHtmlAttribute(node.caption)}"`);
  const size = node.getDisplaySize();
  if (size.mode === 'percent') attributes.push(`style="width: ${size.value}%"`);
  if (size.mode === 'px') attributes.push(`width="${size.px}"`);
  attributes.push('controls');
  if (node.loop) attributes.push('loop');
  return `<video ${attributes.join(' ')}></video>`;
}

function getHtmlTagName(value: string): string {
  return value.match(/^<\s*([\w-]+)/)?.[1]?.toLowerCase() ?? '';
}

function readNumberAttribute(element: Element, name: string): number | undefined {
  const value = element.getAttribute(name);
  return value ? Number.parseInt(value, 10) : undefined;
}

export const VideoPlugin: IEditorPluginConstructor<VideoPluginOptions> = class
  extends KernelPlugin
  implements IEditorPlugin<VideoPluginOptions>
{
  static readonly pluginName = 'VideoPlugin';

  constructor(
    protected kernel: IEditorKernel,
    public config?: VideoPluginOptions,
  ) {
    super();
    kernel.registerNodes([VideoNodeClass]);
    if (config?.theme) {
      kernel.registerThemes(config.theme);
    }
    this.registerDecorator(
      kernel,
      VideoNodeClass.getType(),
      (node: DecoratorNode<any>, editor: LexicalEditor) =>
        config?.decorator ? config.decorator(node as VideoNode, editor) : null,
    );
  }

  onInit(editor: LexicalEditor): void {
    this.register(registerVideoCommand(editor, this.config?.handleUpload));
    this.registerUpload(editor);
    this.registerMarkdown();
    this.registerLiteXml();
    this.registerINode();
  }

  private registerUpload(editor: LexicalEditor) {
    if (!this.config?.handleUpload) return;
    this.kernel
      .requireService(IUploadService)
      ?.registerUpload(
        async (file, _from, range) => editor.dispatchCommand(INSERT_VIDEO_COMMAND, { file, range }),
        UPLOAD_PRIORITY_HIGH,
      );
  }

  private registerMarkdown() {
    const markdownService = this.kernel.requireService(IMarkdownShortCutService);
    if (!markdownService) return;

    markdownService.registerMarkdownWriter(VideoNodeClass.getType(), (ctx, node) => {
      if ($isVideoNode(node)) {
        ctx.appendLine(`${toVideoMarkdown(node)}\n\n`);
      }
    });

    markdownService.registerMarkdownReader('html', (node, children) => {
      const tag = getHtmlTagName(node.value);
      if (tag === 'source') {
        const src = parseHtmlTagAttributes(node.value).src;
        if (!isSafeVideoSrc(src)) return false;
        // A plain empty text node: if no <video> consumes it, Lexical drops it instead of
        // failing on an unregistered node type (paste paths skip the INode tree pass).
        return { ...INodeHelper.createTextNode(''), [VIDEO_SOURCE_FIELD]: src };
      }
      if (tag !== 'video') return false;

      const attributes = parseHtmlTagAttributes(node.value);
      const source = children.find((child) => VIDEO_SOURCE_FIELD in child) as
        Record<typeof VIDEO_SOURCE_FIELD, string> | undefined;
      const src = attributes.src || source?.[VIDEO_SOURCE_FIELD];
      if (!isSafeVideoSrc(src)) return false;

      return INodeHelper.createTypeNode(VideoNodeClass.getType(), {
        ...readVideoSizeAttributes(attributes.style, attributes.width),
        caption: attributes.title || undefined,
        loop: 'loop' in attributes || undefined,
        poster: isSafeVideoSrc(attributes.poster) ? attributes.poster : undefined,
        src,
        version: 1,
      });
    });
  }

  private registerLiteXml() {
    const litexmlService = this.kernel.requireService(ILitexmlService);
    if (!litexmlService) return;

    litexmlService.registerXMLWriter(VideoNodeClass.getType(), (node, ctx) => {
      if (!$isVideoNode(node)) return false;
      const attributes: Record<string, string> = { src: node.src };
      if (node.poster) attributes.poster = node.poster;
      if (node.caption) attributes.caption = node.caption;
      if (node.width) attributes.width = String(node.width);
      if (node.height) attributes.height = String(node.height);
      if (node.displayWidth !== undefined) attributes['display-width'] = String(node.displayWidth);
      if (node.fixedWidth !== undefined) attributes['fixed-width'] = String(node.fixedWidth);
      if (node.loop) attributes.loop = 'true';
      return ctx.createXmlNode('video', attributes);
    });

    litexmlService.registerXMLReader('video', (xmlElement: Element) => {
      const src = xmlElement.getAttribute('src') || '';
      return INodeHelper.createTypeNode(VideoNodeClass.getType(), {
        caption: xmlElement.getAttribute('caption') || undefined,
        displayWidth: sanitizeMediaDisplayWidth(readNumberAttribute(xmlElement, 'display-width')),
        fixedWidth: sanitizeMediaFixedPx(readNumberAttribute(xmlElement, 'fixed-width')),
        height: readNumberAttribute(xmlElement, 'height'),
        loop: xmlElement.getAttribute('loop') === 'true' || undefined,
        poster: xmlElement.getAttribute('poster') || undefined,
        src: isSafeVideoSrc(src) ? src : '',
        version: 1,
        width: readNumberAttribute(xmlElement, 'width'),
      });
    });
  }

  private registerINode() {
    const service = this.kernel.requireService(INodeService);
    if (!service) return;

    service.registerProcessNodeTree(({ root }) => {
      const visit = (node: INode): INode => {
        if (!('children' in node) || !Array.isArray(node.children)) return node;
        const children = (node.children as INode[]).map((child) => visit(child));
        if (
          node.type === 'paragraph' &&
          children.length === 1 &&
          children[0].type === VideoNodeClass.getType()
        ) {
          return children[0];
        }
        (node as { children: INode[] }).children = children;
        return node;
      };
      root.children = (root.children as INode[]).map((child) =>
        visit(child),
      ) as typeof root.children;
    });
  }
};
