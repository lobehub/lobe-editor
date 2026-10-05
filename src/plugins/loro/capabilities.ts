import { $createListItemNode, $createListNode, ListItemNode, ListNode } from '@lexical/list';
import { $createHeadingNode, $createQuoteNode, HeadingNode, QuoteNode } from '@lexical/rich-text';
import {
  $createTableCellNode,
  $createTableNode,
  $createTableRowNode,
  TableCellNode,
  TableNode,
  TableRowNode,
} from '@lexical/table';
import type { LexicalNode } from 'lexical';
import { $createParagraphNode } from 'lexical';

import { $createArtifactNode, ArtifactNode } from '@/plugins/artifact/node/ArtifactNode';
import { $createCodeNode, CodeNode } from '@/plugins/code/node/code';
import {
  $createCodeMirrorNode,
  CodeMirrorNode,
} from '@/plugins/codemirror-block/node/CodeMirrorNode';
import {
  $createCollapsibleNode,
  CollapsibleNode,
} from '@/plugins/collapsible/node/CollapsibleNode';
import { $createBlockFileNode, BlockFileNode } from '@/plugins/file/node/BlockFileNode';
import { $createFileNode, FileNode } from '@/plugins/file/node/FileNode';
import {
  $createHorizontalRuleNode,
  HorizontalRuleNode,
} from '@/plugins/hr/node/HorizontalRuleNode';
import { $createBlockImageNode, BlockImageNode } from '@/plugins/image/node/block-image-node';
import { $createImageNode, ImageNode } from '@/plugins/image/node/image-node';
import { $createLinkBlockCardNode, LinkBlockCardNode } from '@/plugins/link/node/LinkBlockCardNode';
import { $createLinkCardNode, LinkCardNode } from '@/plugins/link/node/LinkCardNode';
import { $createLinkIframeNode, LinkIframeNode } from '@/plugins/link/node/LinkIframeNode';
import {
  $createAutoLinkNode,
  $createLinkNode,
  AutoLinkNode,
  LinkNode,
} from '@/plugins/link/node/LinkNode';
import { $createSchemaNode, SchemaNode } from '@/plugins/link/node/SchemaNode';
import { $createDiffContentNode, DiffContentNode } from '@/plugins/litexml/node/DiffContentNode';
import { $createDiffNode, DiffNode } from '@/plugins/litexml/node/DiffNode';
import {
  $createTableCellDiffNode,
  TableCellDiffNode,
} from '@/plugins/litexml/node/TableCellDiffNode';
import { $createTableRowDiffNode, TableRowDiffNode } from '@/plugins/litexml/node/TableRowDiffNode';
import {
  $createMathBlockNode,
  $createMathInlineNode,
  MathBlockNode,
  MathInlineNode,
} from '@/plugins/math/node';
import { $createMentionNode, MentionNode } from '@/plugins/mention/node/MentionNode';

import type { LoroNodeCapability, LoroNodeData } from './types';

export type LoroCapabilityPhase = 'block' | 'inline';

export interface LoroCapabilityMatrixEntry {
  phase: LoroCapabilityPhase;
  role: LoroNodeCapability['role'];
  type: string;
}

/** The registry inventory is explicit; runtime-only and text-derived types stay outside it. */
export const LORO_CAPABILITY_MATRIX: readonly LoroCapabilityMatrixEntry[] = [
  { phase: 'block', role: 'element', type: 'paragraph' },
  { phase: 'block', role: 'element', type: 'heading' },
  { phase: 'block', role: 'element', type: 'quote' },
  { phase: 'block', role: 'element', type: ListNode.getType() },
  { phase: 'block', role: 'element', type: ListItemNode.getType() },
  { phase: 'block', role: 'element', type: TableNode.getType() },
  { phase: 'block', role: 'element', type: TableRowNode.getType() },
  { phase: 'block', role: 'element', type: TableCellNode.getType() },
  { phase: 'block', role: 'block-decorator', type: HorizontalRuleNode.getType() },
  { phase: 'block', role: 'block-decorator', type: CodeMirrorNode.getType() },
  { phase: 'block', role: 'block-decorator', type: ArtifactNode.getType() },
  { phase: 'block', role: 'block-decorator', type: BlockImageNode.getType() },
  { phase: 'block', role: 'block-decorator', type: BlockFileNode.getType() },
  { phase: 'block', role: 'block-decorator', type: MathBlockNode.getType() },
  { phase: 'block', role: 'block-decorator', type: LinkBlockCardNode.getType() },
  { phase: 'block', role: 'block-decorator', type: LinkIframeNode.getType() },
  { phase: 'block', role: 'element', type: CollapsibleNode.getType() },
  { phase: 'block', role: 'element', type: DiffNode.getType() },
  { phase: 'block', role: 'element', type: DiffContentNode.getType() },
  { phase: 'block', role: 'element', type: TableRowDiffNode.getType() },
  { phase: 'block', role: 'element', type: TableCellDiffNode.getType() },
  { phase: 'inline', role: 'inline', type: 'link' },
  { phase: 'inline', role: 'inline', type: CodeNode.getType() },
  { phase: 'inline', role: 'inline', type: 'autolink' },
  { phase: 'inline', role: 'atom', type: 'schema-link' },
  { phase: 'inline', role: 'inline', type: 'link-card' },
  { phase: 'inline', role: 'atom', type: 'image' },
  { phase: 'inline', role: 'atom', type: 'file' },
  { phase: 'inline', role: 'atom', type: 'math' },
  { phase: 'inline', role: 'atom', type: 'mention' },
];

export const LORO_SYNTHETIC_ID_TYPES = new Set([
  DiffNode.getType(),
  DiffContentNode.getType(),
  TableRowDiffNode.getType(),
  TableCellDiffNode.getType(),
]);

const parentIs =
  (...types: string[]) =>
  (parentType: string | undefined): boolean =>
    parentType === undefined || types.includes(parentType);

const dimension = (value: unknown): number | undefined =>
  typeof value === 'number' && value !== 0 ? value : undefined;

const stringAttr = (data: LoroNodeData, key: string, fallback = ''): string =>
  typeof data.attrs[key] === 'string' ? (data.attrs[key] as string) : fallback;

const applyListAttrs = (node: LexicalNode, attrs: Record<string, unknown>): void => {
  const list = node as ListNode;
  if (typeof attrs.listType === 'string') {
    list.setListType(attrs.listType as 'number' | 'bullet' | 'check');
  }
  if (typeof attrs.start === 'number') list.setStart(attrs.start);
};

const applyListItemAttrs = (node: LexicalNode, attrs: Record<string, unknown>): void => {
  const item = node as ListItemNode;
  if (typeof attrs.value === 'number') item.setValue(attrs.value);
  if (typeof attrs.checked === 'boolean' || attrs.checked === undefined) {
    item.setChecked(attrs.checked as boolean | undefined);
  }
};

const applyBlockImageAttrs = (node: LexicalNode, attrs: Record<string, unknown>): void => {
  const image = node as BlockImageNode;
  if (typeof attrs.src === 'string') image.setSrc(attrs.src);
  if (typeof attrs.altText === 'string') image.setAltText(attrs.altText);
  if (typeof attrs.maxWidth === 'number') image.setMaxWidth(attrs.maxWidth);
  if ('width' in attrs) {
    image.setWidth(typeof attrs.width === 'number' && attrs.width !== 0 ? attrs.width : 'inherit');
  }
  if ('height' in attrs) {
    image.setHeight(
      typeof attrs.height === 'number' && attrs.height !== 0 ? attrs.height : 'inherit',
    );
  }
  if (attrs.status === 'uploaded' || attrs.status === 'loading' || attrs.status === 'error') {
    image.setStatus(attrs.status);
  }
};

const applyBlockFileAttrs = (
  node: LexicalNode,
  attrs: Record<string, unknown>,
  previousAttrs: Record<string, unknown> = {},
): void => {
  const file = node as BlockFileNode;
  if (typeof attrs.name === 'string') file.setName(attrs.name);
  if ('fileUrl' in attrs || 'fileUrl' in previousAttrs)
    file.setFileUrl(typeof attrs.fileUrl === 'string' ? attrs.fileUrl : undefined);
  if ('size' in attrs || 'size' in previousAttrs)
    file.setSize(typeof attrs.size === 'number' ? attrs.size : undefined);
  if (attrs.status === 'pending' || attrs.status === 'uploaded' || attrs.status === 'error') {
    file.setStatus(attrs.status);
  }
  if ('message' in attrs || 'message' in previousAttrs)
    file.setMessage(typeof attrs.message === 'string' ? attrs.message : undefined);
};

const applyMathBlockAttrs = (node: LexicalNode, attrs: Record<string, unknown>): void => {
  if (typeof attrs.code === 'string') (node as MathBlockNode).updateCode(attrs.code);
};

const applyLinkBlockCardAttrs = (node: LexicalNode, attrs: Record<string, unknown>): void => {
  const card = node as LinkBlockCardNode;
  if (typeof attrs.url === 'string') card.setURL(attrs.url);
  if (typeof attrs.title === 'string') card.setTitle(attrs.title);
  if (typeof attrs.icon === 'string') card.setIcon(attrs.icon);
  if (typeof attrs.description === 'string') card.setDescription(attrs.description);
  if (attrs.openTarget === null || typeof attrs.openTarget === 'string') {
    card.setOpenTarget(attrs.openTarget as string | null);
  }
};

const applyLinkIframeAttrs = (node: LexicalNode, attrs: Record<string, unknown>): void => {
  const iframe = node as LinkIframeNode;
  if (typeof attrs.url === 'string') iframe.setURL(attrs.url);
  if (typeof attrs.src === 'string') iframe.setSrc(attrs.src);
  if (typeof attrs.title === 'string') iframe.setTitle(attrs.title);
};

const applyLinkAttrs = (node: LexicalNode, attrs: Record<string, unknown>): void => {
  const link = node as LinkNode;
  if (typeof attrs.url === 'string') link.setURL(attrs.url);
  if (attrs.rel === null || typeof attrs.rel === 'string') link.setRel(attrs.rel as string | null);
  if (attrs.target === null || typeof attrs.target === 'string') {
    link.setTarget(attrs.target as string | null);
  }
  if (attrs.title === null || typeof attrs.title === 'string') {
    link.setTitle(attrs.title as string | null);
  }
};

const applyAutoLinkAttrs = (node: LexicalNode, attrs: Record<string, unknown>): void => {
  applyLinkAttrs(node, attrs);
  if (typeof attrs.isUnlinked === 'boolean') (node as AutoLinkNode).setIsUnlinked(attrs.isUnlinked);
};

const applySchemaAttrs = (node: LexicalNode, attrs: Record<string, unknown>): void => {
  const schema = node as SchemaNode;
  if (typeof attrs.url === 'string') schema.setURL(attrs.url);
  if (typeof attrs.schemaType === 'string') schema.setSchemaType(attrs.schemaType);
  if ('payload' in attrs) schema.setPayload(attrs.payload);
  if (typeof attrs.title === 'string') schema.setTitle(attrs.title);
};

const applyLinkCardAttrs = (node: LexicalNode, attrs: Record<string, unknown>): void => {
  const card = node as LinkCardNode;
  if (typeof attrs.url === 'string') card.setURL(attrs.url);
  if (typeof attrs.title === 'string') card.setTitle(attrs.title);
  if (typeof attrs.icon === 'string') card.setIcon(attrs.icon);
  if (typeof attrs.description === 'string') card.setDescription(attrs.description);
  if (attrs.openTarget === null || typeof attrs.openTarget === 'string') {
    card.setOpenTarget(attrs.openTarget as string | null);
  }
};

const applyImageAttrs = (node: LexicalNode, attrs: Record<string, unknown>): void => {
  const image = node as ImageNode;
  if (typeof attrs.src === 'string') image.setUploaded(attrs.src);
  if (typeof attrs.maxWidth === 'number') image.setMaxWidth(attrs.maxWidth);
  if (typeof attrs.width === 'number' || typeof attrs.height === 'number') {
    image.setWidthAndHeight(
      typeof attrs.width === 'number' && attrs.width !== 0 ? attrs.width : 'inherit',
      typeof attrs.height === 'number' && attrs.height !== 0 ? attrs.height : 'inherit',
    );
  }
  if (attrs.status === 'uploaded' || attrs.status === 'loading' || attrs.status === 'error') {
    image.setStatus(attrs.status);
  }
};

const applyFileAttrs = (
  node: LexicalNode,
  attrs: Record<string, unknown>,
  previousAttrs: Record<string, unknown> = {},
): void => applyBlockFileAttrs(node, attrs, previousAttrs);

const applyMathInlineAttrs = (node: LexicalNode, attrs: Record<string, unknown>): void => {
  if (typeof attrs.code === 'string') (node as MathInlineNode).updateCode(attrs.code);
};

const applyMentionAttrs = (node: LexicalNode, attrs: Record<string, unknown>): void => {
  const mention = node as MentionNode;
  if (typeof attrs.label === 'string') mention.setLabel(attrs.label);
  if (attrs.metadata && typeof attrs.metadata === 'object') {
    mention.setMetadata(attrs.metadata as Record<string, unknown>);
  }
};

const applyCollapsibleAttrs = (node: LexicalNode, attrs: Record<string, unknown>): void => {
  const collapsible = node as CollapsibleNode;
  if (typeof attrs.title === 'string') collapsible.setTitle(attrs.title);
  if (typeof attrs.collapsed === 'boolean') collapsible.setCollapsed(attrs.collapsed);
};

const applyDiffAttrs = (node: LexicalNode, attrs: Record<string, unknown>): void => {
  if (typeof attrs.diffType === 'string' && node instanceof DiffNode) {
    node.setDiffType(attrs.diffType as never);
  }
  if (typeof attrs.side === 'string' && node instanceof DiffContentNode) {
    node.setSide(attrs.side as 'before' | 'after');
  }
  if (typeof attrs.diffType === 'string' && node instanceof TableRowDiffNode) {
    node.setDiffType(attrs.diffType as 'add' | 'remove');
  }
  if (typeof attrs.changeId === 'string' && node instanceof TableRowDiffNode) {
    node.setChangeId(attrs.changeId);
  }
  if (typeof attrs.height === 'number' && node instanceof TableRowDiffNode) {
    node.setHeight(attrs.height);
  }
  if (typeof attrs.diffType === 'string' && node instanceof TableCellDiffNode) {
    node.setDiffType(attrs.diffType as 'add' | 'remove');
  }
  if (typeof attrs.changeId === 'string' && node instanceof TableCellDiffNode) {
    node.setChangeId(attrs.changeId);
  }
};

export const createDefaultLoroCapabilities = (): LoroNodeCapability[] => [
  {
    create: () => $createCodeNode(),
    role: 'inline',
    type: CodeNode.getType(),
  },
  {
    create: () => $createParagraphNode(),
    flowOwner: true,
    role: 'element',
    type: 'paragraph',
  },
  {
    create: (data) =>
      $createHeadingNode((data.attrs.tag as 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6') || 'h1'),
    flowOwner: true,
    role: 'element',
    type: HeadingNode.getType(),
  },
  {
    create: () => $createQuoteNode(),
    flowOwner: true,
    role: 'element',
    type: QuoteNode.getType(),
  },
  {
    allowedParents: parentIs(ListNode.getType(), ListItemNode.getType()),
    create: (data) =>
      $createListNode(
        (data.attrs.listType as 'number' | 'bullet' | 'check') || 'bullet',
        typeof data.attrs.start === 'number' ? data.attrs.start : undefined,
      ),
    applyAttrs: applyListAttrs,
    role: 'element',
    type: ListNode.getType(),
  },
  {
    allowedParents: [ListNode.getType()],
    create: (data) => {
      const node = $createListItemNode(
        typeof data.attrs.checked === 'boolean' ? data.attrs.checked : undefined,
      );
      if (typeof data.attrs.value === 'number') node.setValue(data.attrs.value);
      return node;
    },
    applyAttrs: applyListItemAttrs,
    flowOwner: true,
    role: 'element',
    type: ListItemNode.getType(),
  },
  {
    create: () => $createHorizontalRuleNode(),
    role: 'block-decorator',
    type: HorizontalRuleNode.getType(),
  },
  {
    create: (data) =>
      $createCodeMirrorNode(stringAttr(data, 'language', 'plain'), data.body?.toString() ?? ''),
    embeddedText: 'body',
    role: 'block-decorator',
    type: CodeMirrorNode.getType(),
  },
  {
    create: () => $createTableNode(),
    role: 'element',
    type: TableNode.getType(),
  },
  {
    create: () => $createTableRowNode(),
    role: 'element',
    type: TableRowNode.getType(),
  },
  {
    create: () => $createTableCellNode(),
    role: 'element',
    type: TableCellNode.getType(),
  },
  {
    create: (data) =>
      $createArtifactNode(data.body?.toString() ?? '', stringAttr(data, 'title', 'Artifact')),
    embeddedText: 'body',
    role: 'block-decorator',
    type: ArtifactNode.getType(),
  },
  {
    create: (data) =>
      $createBlockImageNode({
        altText: stringAttr(data, 'altText'),
        height: dimension(data.attrs.height),
        maxWidth: typeof data.attrs.maxWidth === 'number' ? data.attrs.maxWidth : 4200,
        src: stringAttr(data, 'src'),
        status: data.attrs.status as 'uploaded' | 'loading' | 'error' | undefined,
        width: dimension(data.attrs.width),
      }),
    applyAttrs: applyBlockImageAttrs,
    role: 'block-decorator',
    type: BlockImageNode.getType(),
  },
  {
    create: (data) =>
      $createBlockFileNode(
        stringAttr(data, 'name', 'unknown'),
        typeof data.attrs.fileUrl === 'string' ? data.attrs.fileUrl : undefined,
        typeof data.attrs.size === 'number' ? data.attrs.size : undefined,
        data.attrs.status as 'pending' | 'uploaded' | 'error' | undefined,
        typeof data.attrs.message === 'string' ? data.attrs.message : undefined,
      ),
    applyAttrs: applyBlockFileAttrs,
    role: 'block-decorator',
    type: BlockFileNode.getType(),
  },
  {
    applyAttrs: applyMathBlockAttrs,
    create: (data) => $createMathBlockNode(stringAttr(data, 'code')),
    role: 'block-decorator',
    type: MathBlockNode.getType(),
  },
  {
    create: (data) =>
      $createLinkBlockCardNode({
        description: stringAttr(data, 'description'),
        icon: stringAttr(data, 'icon'),
        openTarget: typeof data.attrs.openTarget === 'string' ? data.attrs.openTarget : null,
        title: stringAttr(data, 'title'),
        url: stringAttr(data, 'url'),
      }),
    applyAttrs: applyLinkBlockCardAttrs,
    role: 'block-decorator',
    type: LinkBlockCardNode.getType(),
  },
  {
    create: (data) =>
      $createLinkIframeNode({
        src: stringAttr(data, 'src'),
        title: stringAttr(data, 'title'),
        url: stringAttr(data, 'url'),
      }),
    applyAttrs: applyLinkIframeAttrs,
    role: 'block-decorator',
    type: LinkIframeNode.getType(),
  },
  {
    create: (data) =>
      $createCollapsibleNode(stringAttr(data, 'title', 'Details'), Boolean(data.attrs.collapsed)),
    applyAttrs: applyCollapsibleAttrs,
    role: 'element',
    type: CollapsibleNode.getType(),
  },
  {
    applyAttrs: applyDiffAttrs,
    create: (data) => $createDiffNode((data.attrs.diffType as never) || 'unchanged'),
    role: 'element',
    type: DiffNode.getType(),
  },
  {
    allowedParents: [DiffNode.getType()],
    applyAttrs: applyDiffAttrs,
    create: (data) => $createDiffContentNode((data.attrs.side as 'before' | 'after') || 'after'),
    role: 'element',
    type: DiffContentNode.getType(),
  },
  {
    allowedParents: [TableNode.getType()],
    applyAttrs: applyDiffAttrs,
    create: (data) =>
      $createTableRowDiffNode(
        (data.attrs.diffType as 'add' | 'remove') || 'add',
        typeof data.attrs.changeId === 'string' ? data.attrs.changeId : undefined,
        typeof data.attrs.height === 'number' ? data.attrs.height : undefined,
      ),
    role: 'element',
    type: TableRowDiffNode.getType(),
  },
  {
    allowedParents: [TableRowDiffNode.getType()],
    applyAttrs: applyDiffAttrs,
    create: (data) =>
      $createTableCellDiffNode(
        (data.attrs.diffType as 'add' | 'remove') || 'add',
        typeof data.attrs.changeId === 'string' ? data.attrs.changeId : undefined,
        typeof data.attrs.headerState === 'number' ? data.attrs.headerState : undefined,
        typeof data.attrs.colSpan === 'number' ? data.attrs.colSpan : undefined,
        typeof data.attrs.width === 'number' ? data.attrs.width : undefined,
      ),
    role: 'element',
    type: TableCellDiffNode.getType(),
  },
  {
    create: (data) =>
      $createLinkNode(stringAttr(data, 'url'), {
        rel: typeof data.attrs.rel === 'string' ? data.attrs.rel : null,
        target: typeof data.attrs.target === 'string' ? data.attrs.target : null,
        title: typeof data.attrs.title === 'string' ? data.attrs.title : null,
      }),
    applyAttrs: applyLinkAttrs,
    role: 'inline',
    type: LinkNode.getType(),
  },
  {
    create: (data) =>
      $createAutoLinkNode(stringAttr(data, 'url'), {
        isUnlinked: Boolean(data.attrs.isUnlinked),
        rel: typeof data.attrs.rel === 'string' ? data.attrs.rel : null,
        target: typeof data.attrs.target === 'string' ? data.attrs.target : null,
        title: typeof data.attrs.title === 'string' ? data.attrs.title : null,
      }),
    applyAttrs: applyAutoLinkAttrs,
    role: 'inline',
    type: AutoLinkNode.getType(),
  },
  {
    create: (data) =>
      $createSchemaNode({
        payload: data.attrs.payload,
        schemaType: stringAttr(data, 'schemaType'),
        title: stringAttr(data, 'title'),
        url: stringAttr(data, 'url'),
      }),
    applyAttrs: applySchemaAttrs,
    role: 'atom',
    type: SchemaNode.getType(),
  },
  {
    create: (data) =>
      $createLinkCardNode({
        description: stringAttr(data, 'description'),
        icon: stringAttr(data, 'icon'),
        openTarget: typeof data.attrs.openTarget === 'string' ? data.attrs.openTarget : null,
        title: stringAttr(data, 'title'),
        url: stringAttr(data, 'url'),
      }),
    applyAttrs: applyLinkCardAttrs,
    role: 'atom',
    type: LinkCardNode.getType(),
  },
  {
    create: (data) =>
      $createImageNode({
        altText: stringAttr(data, 'altText'),
        height: typeof data.attrs.height === 'number' ? data.attrs.height : undefined,
        maxWidth: typeof data.attrs.maxWidth === 'number' ? data.attrs.maxWidth : 4200,
        src: stringAttr(data, 'src'),
        status: data.attrs.status as 'uploaded' | 'loading' | 'error' | undefined,
        width: typeof data.attrs.width === 'number' ? data.attrs.width : undefined,
      }),
    applyAttrs: applyImageAttrs,
    role: 'atom',
    type: ImageNode.getType(),
  },
  {
    create: (data) =>
      $createFileNode(
        stringAttr(data, 'name', 'unknown'),
        typeof data.attrs.fileUrl === 'string' ? data.attrs.fileUrl : undefined,
        typeof data.attrs.size === 'number' ? data.attrs.size : undefined,
        data.attrs.status as 'pending' | 'uploaded' | 'error' | undefined,
        typeof data.attrs.message === 'string' ? data.attrs.message : undefined,
      ),
    applyAttrs: applyFileAttrs,
    role: 'atom',
    type: FileNode.getType(),
  },
  {
    create: (data) => $createMathInlineNode(stringAttr(data, 'code')),
    applyAttrs: applyMathInlineAttrs,
    role: 'atom',
    type: MathInlineNode.getType(),
  },
  {
    create: (data) =>
      $createMentionNode(
        stringAttr(data, 'label'),
        (data.attrs.metadata as Record<string, unknown>) || {},
      ),
    applyAttrs: applyMentionAttrs,
    role: 'atom',
    type: MentionNode.getType(),
  },
];

export const getCapabilityMatrix = (): readonly LoroCapabilityMatrixEntry[] =>
  LORO_CAPABILITY_MATRIX;

export const isKnownLoroCapabilityType = (type: string): boolean =>
  LORO_CAPABILITY_MATRIX.some((entry) => entry.type === type);

export const isCapabilityParentAllowed = (
  capability: LoroNodeCapability,
  parentType: string | undefined,
): boolean => {
  if (!capability.allowedParents) return true;
  if (typeof capability.allowedParents === 'function') {
    return capability.allowedParents(parentType);
  }
  return capability.allowedParents.includes(parentType ?? 'root');
};

export const requiresSyntheticCapabilityIdentity = (type: string): boolean =>
  LORO_SYNTHETIC_ID_TYPES.has(type);

export const isLexicalNode = (value: unknown): value is LexicalNode =>
  Boolean(value && typeof value === 'object' && 'getType' in value);
