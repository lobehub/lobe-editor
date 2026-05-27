import type {
  ElementNode,
  LexicalEditor,
  LexicalNode,
  SerializedElementNode,
  SerializedLexicalNode,
} from 'lexical';
import { $getRoot, $isElementNode } from 'lexical';

import { INodeHelper } from '@/editor-kernel/inode/helper';
import type { IElementNode } from '@/editor-kernel/inode/i-element-node';
import { MarkdownWriterContext } from '@/plugins/markdown/data-source/markdown-writer-context';
import type {
  IMarkdownShortCutService,
  MarkdownShortCutService,
} from '@/plugins/markdown/service/shortcut';

import type {
  ContentBlock,
  ExtractContentBlocksOptions,
  FileContentBlock,
  ImageContentBlock,
} from '../types';

const ATOMIC_TYPES = new Set(['image', 'block-image', 'file']);
const SPLITTABLE_CONTAINER_TYPES = new Set(['paragraph', 'heading', 'quote']);

const PLACEHOLDERS = {
  fileError: (name: string, msg?: string) =>
    msg ? `[file upload failed: ${name}: ${msg}]` : `[file upload failed: ${name}]`,
  fileLoading: (name: string) => `[file uploading: ${name}]`,
  imageError: (msg?: string | null) =>
    msg ? `[image upload failed: ${msg}]` : '[image upload failed]',
  imageLoading: '[image uploading...]',
};

type ImageLikeNode = LexicalNode & {
  __altText?: string;
  __height?: 'inherit' | number;
  __message?: string | null;
  __src?: string;
  __status?: 'uploaded' | 'loading' | 'error';
  __width?: 'inherit' | number;
  getAltText?: () => string;
  getSrc?: () => string;
};

type FileLikeNode = LexicalNode & {
  __fileUrl?: string;
  __message?: string;
  __name?: string;
  __size?: number;
  __status?: 'pending' | 'uploaded' | 'error';
};

const isAtomicNode = (node: LexicalNode): boolean => ATOMIC_TYPES.has(node.getType());

const isInlineAtomicNode = (node: LexicalNode): boolean => node.getType() === 'image';

const isImageType = (type: string) => type === 'image' || type === 'block-image';

const readImage = (
  node: ImageLikeNode,
): {
  alt: string;
  height: number;
  message: string | null;
  src: string;
  status: 'uploaded' | 'loading' | 'error';
  width: number;
} => {
  const src = node.getSrc?.() ?? node.__src ?? '';
  const alt = node.getAltText?.() ?? node.__altText ?? '';
  const rawWidth = node.__width;
  const rawHeight = node.__height;
  const width = typeof rawWidth === 'number' ? rawWidth : 0;
  const height = typeof rawHeight === 'number' ? rawHeight : 0;
  return {
    alt,
    height,
    message: node.__message ?? null,
    src,
    status: node.__status ?? 'uploaded',
    width,
  };
};

const readFile = (
  node: FileLikeNode,
): {
  message?: string;
  name: string;
  size?: number;
  status: 'pending' | 'uploaded' | 'error';
  url: string;
} => ({
  message: node.__message,
  name: node.__name ?? 'unknown',
  size: node.__size,
  status: node.__status ?? 'pending',
  url: node.__fileUrl ?? '',
});

const buildImageBlock = (node: ImageLikeNode): ImageContentBlock | null => {
  const info = readImage(node);
  if (info.status !== 'uploaded' || !info.src) return null;
  const block: ImageContentBlock = {
    alt: info.alt,
    type: 'image',
    url: info.src,
  };
  if (info.width > 0) block.width = info.width;
  if (info.height > 0) block.height = info.height;
  return block;
};

const buildFileBlock = (node: FileLikeNode): FileContentBlock | null => {
  const info = readFile(node);
  if (info.status !== 'uploaded' || !info.url) return null;
  const block: FileContentBlock = {
    name: info.name,
    type: 'file',
    url: info.url,
  };
  if (typeof info.size === 'number') block.size = info.size;
  return block;
};

const placeholderForImage = (node: ImageLikeNode): string => {
  const info = readImage(node);
  if (info.status === 'error') return PLACEHOLDERS.imageError(info.message);
  return PLACEHOLDERS.imageLoading;
};

const placeholderForFile = (node: FileLikeNode): string => {
  const info = readFile(node);
  if (info.status === 'error') return PLACEHOLDERS.fileError(info.name, info.message);
  return PLACEHOLDERS.fileLoading(info.name);
};

const hasDirectInlineAtomic = (element: ElementNode): boolean => {
  for (const child of element.getChildren()) {
    if (isInlineAtomicNode(child)) return true;
  }
  return false;
};

const exportTree = (node: LexicalNode): SerializedLexicalNode => {
  const json = node.exportJSON();
  if ($isElementNode(node)) {
    const elJson = json as SerializedElementNode;
    elJson.children = node.getChildren().map((child) => exportTree(child));
  }
  return json;
};

const renderTextBuffer = (
  editor: LexicalEditor,
  service: IMarkdownShortCutService,
  buffer: SerializedLexicalNode[],
): string => {
  if (buffer.length === 0) return '';
  const synRoot = INodeHelper.createRootNode();
  INodeHelper.appendChild(synRoot, ...(buffer as unknown as IElementNode[]));
  const synState = editor.parseEditorState({ root: synRoot });
  const ctx = new MarkdownWriterContext(service as MarkdownShortCutService);
  return synState.read(() => {
    const root = synState._nodeMap.get('root') as ElementNode;
    root.getChildren().forEach((child) => ctx.processChild(ctx, child));
    return ctx.toString();
  });
};

const pushPlaceholderParagraph = (buffer: SerializedLexicalNode[], text: string): void => {
  const para = INodeHelper.createParagraph();
  INodeHelper.appendChild(para, INodeHelper.createTextNode(text));
  buffer.push(para as unknown as SerializedLexicalNode);
};

const cloneElementShell = (element: ElementNode): IElementNode => {
  const json = element.exportJSON() as unknown as IElementNode;
  return { ...json, children: [] };
};

const mergeAdjacentTextBlocks = (blocks: ContentBlock[]): ContentBlock[] => {
  const out: ContentBlock[] = [];
  for (const block of blocks) {
    const prev = out.at(-1);
    if (block.type === 'text' && prev?.type === 'text') {
      prev.text = `${prev.text}\n\n${block.text}`;
    } else {
      out.push(block);
    }
  }
  return out;
};

export const extractContentBlocks = (
  editor: LexicalEditor,
  service: IMarkdownShortCutService,
  options: ExtractContentBlocksOptions = {},
): ContentBlock[] => {
  const emitPlaceholder = options.emitPlaceholderForUnuploaded ?? true;

  return editor.getEditorState().read(() => {
    const root = $getRoot();
    const blocks: ContentBlock[] = [];
    const textBuffer: SerializedLexicalNode[] = [];

    const flushText = () => {
      if (textBuffer.length === 0) return;
      const md = renderTextBuffer(editor, service, textBuffer).trim();
      textBuffer.length = 0;
      if (md) blocks.push({ text: md, type: 'text' });
    };

    const emitAtomic = (node: LexicalNode) => {
      if (isImageType(node.getType())) {
        const block = buildImageBlock(node as ImageLikeNode);
        if (block) {
          flushText();
          blocks.push(block);
          return;
        }
        if (emitPlaceholder) {
          pushPlaceholderParagraph(textBuffer, placeholderForImage(node as ImageLikeNode));
        }
        return;
      }
      // file
      const fNode = node as FileLikeNode;
      const block = buildFileBlock(fNode);
      if (block) {
        flushText();
        blocks.push(block);
        return;
      }
      if (emitPlaceholder) {
        pushPlaceholderParagraph(textBuffer, placeholderForFile(fNode));
      }
    };

    const visitTopLevel = (node: LexicalNode) => {
      if (isAtomicNode(node)) {
        // Root-level atomic — always emit as its own block, even if the node
        // class declares isInline() (chat editors place inline images inside
        // paragraphs; at root they are effectively block-level).
        emitAtomic(node);
        return;
      }

      if (!$isElementNode(node)) {
        textBuffer.push(exportTree(node));
        return;
      }

      if (
        !SPLITTABLE_CONTAINER_TYPES.has(node.getType()) ||
        !hasDirectInlineAtomic(node as ElementNode)
      ) {
        textBuffer.push(exportTree(node));
        return;
      }

      // Split the splittable container by its direct inline atomic children.
      let currentShell = cloneElementShell(node as ElementNode);
      const commitShell = () => {
        if (currentShell.children && currentShell.children.length > 0) {
          textBuffer.push(currentShell as unknown as SerializedLexicalNode);
        }
        currentShell = cloneElementShell(node as ElementNode);
      };

      for (const child of (node as ElementNode).getChildren()) {
        if (isInlineAtomicNode(child)) {
          commitShell();
          emitAtomic(child);
        } else {
          currentShell.children!.push(exportTree(child));
        }
      }
      commitShell();
    };

    root.getChildren().forEach(visitTopLevel);
    flushText();

    return mergeAdjacentTextBlocks(blocks);
  });
};
