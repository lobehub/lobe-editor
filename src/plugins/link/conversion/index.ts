/* eslint-disable @typescript-eslint/no-use-before-define */
import {
  $createParagraphNode,
  $createTextNode,
  $getNodeByKey,
  $isParagraphNode,
  $isRootNode,
  LexicalEditor,
  LexicalNode,
} from 'lexical';

import { $createLinkCardNode, $isLinkCardNode, LinkCardNode } from '../node/LinkCardNode';
import { $createLinkIframeNode, $isLinkIframeNode, LinkIframeNode } from '../node/LinkIframeNode';
import { $createLinkNode, $isLinkNode, LinkNode } from '../node/LinkNode';
import { $createSchemaNode, $isSchemaNode, SchemaNode } from '../node/SchemaNode';
import {
  LinkRuleContext,
  LinkService,
  LinkToolbarNode,
  getNodeTitle,
  getNodeUrl,
} from '../service/i-link-service';

export interface LinkToolbarCapabilities {
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
    canConvertToCard:
      ($isLinkNode(node) && Boolean(embedRule?.allowCard)) || $isLinkIframeNode(node),
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
  const cardNode = $createLinkCardNode({
    description: payload?.description,
    icon: payload?.icon,
    openTarget: payload?.openTarget || ($isLinkNode(node) ? node.getTarget() : null) || '_blank',
    title: payload?.title || title,
    url: payload?.url || url,
  });
  replaceWithInlineNode(node, cardNode);
  return cardNode;
}

export function replaceNodeByKeyWithCardNode(
  editor: LexicalEditor,
  key: string,
  linkService: LinkService,
): void {
  editor.update(() => {
    const node = $getNodeByKey(key);
    if (!$isLinkNode(node) && !$isLinkIframeNode(node)) return;
    replaceWithCardNode(node, editor, linkService);
  });
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
  const parent = node.getParent();
  if (parent && !$isRootNode(parent) && !parent.isInline() && parent.getChildrenSize() === 1) {
    parent.replace(iframeNode);
    return;
  }
  if (parent && $isParagraphNode(parent)) {
    const previousSiblings = node.getPreviousSiblings();
    const nextSiblings = node.getNextSiblings();

    if (previousSiblings.length === 0) {
      parent.insertBefore(iframeNode);
      node.remove();
      if (parent.getChildrenSize() === 0) parent.remove();
      return;
    }

    if (nextSiblings.length === 0) {
      parent.insertAfter(iframeNode);
      node.remove();
      return;
    }

    const nextParagraph = $createParagraphNode();
    nextParagraph.setFormat(parent.getFormatType());
    nextParagraph.setIndent(parent.getIndent());
    nextParagraph.setDirection(parent.getDirection());
    nextParagraph.append(...nextSiblings);

    parent.insertAfter(iframeNode);
    iframeNode.insertAfter(nextParagraph);
    node.remove();
    return;
  }
  node.replace(iframeNode);
}

export function $isLinkToolbarNode(node: LexicalNode | null | undefined): node is LinkToolbarNode {
  return (
    $isLinkNode(node) || $isLinkCardNode(node) || $isLinkIframeNode(node) || $isSchemaNode(node)
  );
}

function createRuleContext(editor: LexicalEditor, text: string, title: string): LinkRuleContext {
  return { editor, text, title };
}

function normalizeSchemaPayload(payload: Record<string, unknown>): Record<string, unknown> {
  if ('payload' in payload || 'schemaType' in payload || 'title' in payload || 'url' in payload) {
    return payload;
  }
  return { payload };
}
