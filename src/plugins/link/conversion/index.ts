import type { LexicalEditor, LexicalNode } from 'lexical';
import {
  $createParagraphNode,
  $createTextNode,
  $getNodeByKey,
  $isParagraphNode,
  $isRootNode,
} from 'lexical';

import { $createLinkBlockCardNode, $isLinkBlockCardNode } from '../node/LinkBlockCardNode';
import type { LinkCardNode } from '../node/LinkCardNode';
import { $createLinkCardNode, $isLinkCardNode } from '../node/LinkCardNode';
import type { LinkIframeNode } from '../node/LinkIframeNode';
import { $createLinkIframeNode, $isLinkIframeNode } from '../node/LinkIframeNode';
import type { LinkNode } from '../node/LinkNode';
import { $createLinkNode, $isLinkNode } from '../node/LinkNode';
import type { SchemaNode } from '../node/SchemaNode';
import { $createSchemaNode, $isSchemaNode } from '../node/SchemaNode';
import type {
  LinkEmbedRule,
  LinkRuleContext,
  LinkService,
  LinkToolbarNode,
} from '../service/i-link-service';
import { getNodeTitle, getNodeUrl } from '../service/i-link-service';

export interface LinkToolbarCapabilities {
  canConvertToBlockCard: boolean;
  canConvertToCard: boolean;
  canConvertToIframe: boolean;
  canConvertToLink: boolean;
  canConvertToSchema: boolean;
}

export function getLinkToolbarCapabilities(
  node: LinkToolbarNode,
  editor: LexicalEditor,
  linkService: LinkService | null,
): LinkToolbarCapabilities {
  const url = getNodeUrl(node);
  const title = getNodeTitle(node);
  const context = createRuleContext(editor, title, title);
  const embedRule = linkService?.getEmbedRule(url, context);
  const schemaRule =
    $isLinkNode(node) &&
    linkService?.getSchemaRule(url, {
      ...context,
      schema: linkService.parseSchemaUrl(url),
    });

  return {
    canConvertToBlockCard:
      ($isLinkNode(node) && Boolean(embedRule?.allowBlockCard)) ||
      ($isLinkCardNode(node) && !$isLinkBlockCardNode(node)) ||
      $isLinkIframeNode(node),
    canConvertToCard:
      ($isLinkNode(node) && Boolean(embedRule?.allowCard)) ||
      $isLinkIframeNode(node) ||
      $isLinkBlockCardNode(node),
    canConvertToIframe:
      ($isLinkNode(node) && Boolean(embedRule?.allowIframe)) || $isLinkCardNode(node),
    canConvertToLink: !$isLinkNode(node),
    canConvertToSchema: $isLinkNode(node) && Boolean(schemaRule),
  };
}

export function convertLinkToolbarNodeToLink(node: LinkToolbarNode): LinkNode {
  const url = getNodeUrl(node);
  const title = getNodeTitle(node);
  const linkNode = $createLinkNode(url, {
    target: $isLinkCardNode(node) ? node.getOpenTarget() : null,
    title,
  });
  linkNode.append($createTextNode(title));
  replaceWithInlineNode(node, linkNode);
  return linkNode;
}

export function convertLinkToolbarNodeByKeyToLink(editor: LexicalEditor, key: string): void {
  editor.update(() => {
    const node = $getNodeByKey(key);
    if (!$isLinkToolbarNode(node)) return;
    convertLinkToolbarNodeToLink(node).selectEnd();
  });
}

export function convertLinkNodeToSchema(
  node: LinkNode,
  editor: LexicalEditor,
  linkService: LinkService,
): SchemaNode | null {
  const url = node.getURL();
  const title = node.getTitle() || node.getTextContent() || url;
  const schema = linkService.parseSchemaUrl(url);
  const rule = linkService.getSchemaRule(url, {
    ...createRuleContext(editor, node.getTextContent(), title),
    schema,
  });
  if (!rule) return null;
  const parsed = rule.parse?.(url, schema);
  const payload =
    parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? normalizeSchemaPayload(parsed as Record<string, unknown>)
      : { payload: parsed };
  const schemaNode = $createSchemaNode({
    payload: payload.payload,
    schemaType: (payload.schemaType as string | undefined) || rule.id,
    title: (payload.title as string | undefined) || title,
    url: (payload.url as string | undefined) || url,
  });
  node.replace(schemaNode);
  return schemaNode;
}

export function convertLinkNodeByKeyToSchema(
  editor: LexicalEditor,
  key: string,
  linkService: LinkService,
): void {
  editor.update(() => {
    const node = $getNodeByKey(key);
    if (!$isLinkNode(node)) return;
    convertLinkNodeToSchema(node, editor, linkService);
  });
}

export function replaceWithCardNode(
  node: LinkNode | LinkIframeNode,
  editor: LexicalEditor,
  linkService: LinkService,
): LinkCardNode {
  const url = getNodeUrl(node);
  const title = getNodeTitle(node);
  const context = createRuleContext(editor, title, title);
  const rule = linkService.getEmbedRule(url, context);
  const payload = rule?.getCardPayload?.(url, context);

  if (isPromiseLike(payload)) {
    throw new TypeError(
      'Async link card payloads require replaceNodeByKeyWithCardNode so the Lexical update does not cross an await boundary.',
    );
  }

  return replaceWithResolvedCardNode(node, payload, { title, url }, 'inline');
}

export function replaceWithBlockCardNode(
  node: LinkNode | LinkCardNode | LinkIframeNode,
  editor: LexicalEditor,
  linkService: LinkService,
): LinkCardNode {
  const url = getNodeUrl(node);
  const title = getNodeTitle(node);
  const context = createRuleContext(editor, title, title);
  const rule = linkService.getEmbedRule(url, context);
  const payload = $isLinkCardNode(node)
    ? getExistingCardPayload(node)
    : rule?.getCardPayload?.(url, context);

  if (isPromiseLike(payload)) {
    throw new TypeError(
      'Async link card payloads require replaceNodeByKeyWithBlockCardNode so the Lexical update does not cross an await boundary.',
    );
  }

  return replaceWithResolvedCardNode(node, payload, { title, url }, 'block');
}

function replaceWithResolvedCardNode(
  node: LinkNode | LinkCardNode | LinkIframeNode,
  payload: Awaited<ReturnType<NonNullable<LinkEmbedRule['getCardPayload']>>> | undefined,
  fallback: { title: string; url: string },
  layout: 'block' | 'inline',
): LinkCardNode {
  const cardPayload = {
    description: payload?.description,
    icon: payload?.icon,
    openTarget:
      payload?.openTarget ||
      ($isLinkNode(node)
        ? node.getTarget()
        : $isLinkCardNode(node)
          ? node.getOpenTarget()
          : null) ||
      '_blank',
    title: payload?.title || fallback.title,
    url: payload?.url || fallback.url,
  };
  const cardNode =
    layout === 'block' ? $createLinkBlockCardNode(cardPayload) : $createLinkCardNode(cardPayload);

  if (layout === 'block') {
    replaceWithBlockNode(node, cardNode);
  } else {
    replaceWithInlineNode(node, cardNode);
  }
  return cardNode;
}

export async function replaceNodeByKeyWithCardNode(
  editor: LexicalEditor,
  key: string,
  linkService: LinkService,
  layout: 'block' | 'inline' = 'inline',
): Promise<void> {
  let request:
    | {
        payload: ReturnType<NonNullable<LinkEmbedRule['getCardPayload']>> | undefined;
        title: string;
        url: string;
      }
    | undefined;

  editor.getEditorState().read(() => {
    const node = $getNodeByKey(key);
    if (!$isLinkNode(node) && !$isLinkCardNode(node) && !$isLinkIframeNode(node)) return;

    const url = getNodeUrl(node);
    const title = getNodeTitle(node);
    const context = createRuleContext(editor, title, title);
    const rule = linkService.getEmbedRule(url, context);
    request = {
      payload: $isLinkCardNode(node)
        ? getExistingCardPayload(node)
        : rule?.getCardPayload?.(url, context),
      title,
      url,
    };
  });

  if (!request) return;
  const resolvedRequest = request;

  let payload: Awaited<typeof resolvedRequest.payload> | undefined;
  try {
    payload = await resolvedRequest.payload;
  } catch {
    payload = undefined;
  }

  editor.update(() => {
    const node = $getNodeByKey(key);
    if (!$isLinkNode(node) && !$isLinkCardNode(node) && !$isLinkIframeNode(node)) return;
    if (getNodeUrl(node) !== resolvedRequest.url) return;

    replaceWithResolvedCardNode(node, payload, resolvedRequest, layout);
  });
}

export function replaceNodeByKeyWithBlockCardNode(
  editor: LexicalEditor,
  key: string,
  linkService: LinkService,
): Promise<void> {
  return replaceNodeByKeyWithCardNode(editor, key, linkService, 'block');
}

export function replaceWithIframeNode(
  node: LinkNode | LinkCardNode,
  editor: LexicalEditor,
  linkService: LinkService,
): LinkIframeNode {
  const url = getNodeUrl(node);
  const title = getNodeTitle(node);
  const context = createRuleContext(editor, title, title);
  const rule = linkService.getEmbedRule(url, context);
  const payload = rule?.getIframePayload?.(url, context);
  const iframeNode = $createLinkIframeNode({
    src: payload?.src || url,
    title: payload?.title || title,
    url: payload?.url || url,
  });
  replaceWithBlockIframeNode(node, iframeNode);
  return iframeNode;
}

export function replaceNodeByKeyWithIframeNode(
  editor: LexicalEditor,
  key: string,
  linkService: LinkService,
): void {
  editor.update(() => {
    const node = $getNodeByKey(key);
    if (!$isLinkNode(node) && !$isLinkCardNode(node)) return;
    replaceWithIframeNode(node, editor, linkService);
  });
}

export function replaceWithInlineNode(node: LexicalNode, inlineNode: LexicalNode): void {
  if (node.isInline()) {
    node.replace(inlineNode);
    return;
  }

  const paragraph = $createParagraphNode();
  paragraph.append(inlineNode);
  node.replace(paragraph);
}

export function replaceWithBlockIframeNode(node: LexicalNode, iframeNode: LinkIframeNode): void {
  replaceWithBlockNode(node, iframeNode);
}

export function replaceWithBlockNode(node: LexicalNode, blockNode: LexicalNode): void {
  const parent = node.getParent();
  if (parent && !$isRootNode(parent) && !parent.isInline() && parent.getChildrenSize() === 1) {
    parent.replace(blockNode);
    return;
  }
  if (parent && $isParagraphNode(parent)) {
    const previousSiblings = node.getPreviousSiblings();
    const nextSiblings = node.getNextSiblings();

    if (previousSiblings.length === 0) {
      parent.insertBefore(blockNode);
      node.remove();
      if (parent.getChildrenSize() === 0) parent.remove();
      return;
    }

    if (nextSiblings.length === 0) {
      parent.insertAfter(blockNode);
      node.remove();
      return;
    }

    const nextParagraph = $createParagraphNode();
    nextParagraph.setFormat(parent.getFormatType());
    nextParagraph.setIndent(parent.getIndent());
    nextParagraph.setDirection(parent.getDirection());
    nextParagraph.append(...nextSiblings);

    parent.insertAfter(blockNode);
    blockNode.insertAfter(nextParagraph);
    node.remove();
    return;
  }
  node.replace(blockNode);
}

export function $isLinkToolbarNode(node: LexicalNode | null | undefined): node is LinkToolbarNode {
  return (
    $isLinkNode(node) || $isLinkCardNode(node) || $isLinkIframeNode(node) || $isSchemaNode(node)
  );
}

function createRuleContext(editor: LexicalEditor, text: string, title: string): LinkRuleContext {
  return { editor, text, title };
}

function isPromiseLike<T>(value: T | Promise<T> | undefined): value is Promise<T> {
  return Boolean(value && typeof (value as Promise<T>).then === 'function');
}

function getExistingCardPayload(node: LinkCardNode) {
  return {
    description: node.getDescription(),
    icon: node.getIcon(),
    openTarget: node.getOpenTarget(),
    title: node.getTitle(),
    url: node.getURL(),
  };
}

function normalizeSchemaPayload(payload: Record<string, unknown>): Record<string, unknown> {
  if ('payload' in payload || 'schemaType' in payload || 'title' in payload || 'url' in payload) {
    return payload;
  }
  return { payload };
}
