import type { LexicalEditor, LexicalNode, NodeKey } from 'lexical';
import {
  $createParagraphNode,
  $createTextNode,
  $getNodeByKey,
  $isParagraphNode,
  $isRootNode,
} from 'lexical';

import { $createHoleNode, $isHoleNode, type HoleNode } from '@/plugins/common/node/hole';
import { $preserveNodeIdentity } from '@/plugins/properties/utils';

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

export function convertLinkToolbarNodeByKeyToLink(
  editor: LexicalEditor,
  key: string,
): NodeKey | null {
  let replacementKey: NodeKey | null = null;
  editor.update(
    () => {
      const node = $getNodeByKey(key);
      if (!$isLinkToolbarNode(node)) return;
      const linkNode = convertLinkToolbarNodeToLink(node);
      replacementKey = linkNode.getKey();
      linkNode.selectEnd();
    },
    { discrete: true },
  );
  return replacementKey;
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
  editor.update(
    () => {
      const node = $getNodeByKey(key);
      if (!$isLinkNode(node)) return;
      convertLinkNodeToSchema(node, editor, linkService)?.selectNext();
    },
    { discrete: true },
  );
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
    let payload: ReturnType<NonNullable<LinkEmbedRule['getCardPayload']>> | undefined;
    try {
      payload = $isLinkCardNode(node)
        ? getExistingCardPayload(node)
        : rule?.getCardPayload?.(url, context);
    } catch {
      // Metadata is an enhancement. A synchronous provider failure must not
      // turn a valid toolbar action into a silent no-op.
      payload = undefined;
    }
    request = {
      payload,
      title,
      url,
    };
  });

  if (!request) return;
  const resolvedRequest = request;

  let replacementKey: NodeKey | null = null;
  const replaceCurrentNode = (
    payload: Awaited<typeof resolvedRequest.payload> | undefined,
  ): void => {
    const node = $getNodeByKey(key);
    if (!$isLinkNode(node) && !$isLinkCardNode(node) && !$isLinkIframeNode(node)) return;
    if (getNodeUrl(node) !== resolvedRequest.url) return;

    const replacement = replaceWithResolvedCardNode(node, payload, resolvedRequest, layout);
    replacementKey = replacement.getKey();
    // Toolbar actions preserve the range selection on the source link. Move
    // it away from that node before the update commits; otherwise Lexical
    // rejects the update because the selected node was removed, making the
    // conversion look like a silent no-op.
    replacement.selectNext();
  };

  const initialPayload = resolvedRequest.payload;
  if (!isPromiseLike(initialPayload)) {
    editor.update(() => replaceCurrentNode(initialPayload), { discrete: true });
    return;
  }

  // Give the pointer action immediate, deterministic feedback. Metadata can
  // be slow or never settle, so first create a usable fallback card and then
  // hydrate that exact replacement by key when the request completes.
  editor.update(() => replaceCurrentNode(undefined), { discrete: true });
  if (!replacementKey) return;
  const cardKey = replacementKey;
  linkService.setCardMetadataLoading(cardKey, true);

  try {
    const resolvedPayload = await initialPayload;
    if (!resolvedPayload) return;

    editor.update(
      () => {
        const cardNode = $getNodeByKey(cardKey);
        if (!$isLinkCardNode(cardNode) || getNodeUrl(cardNode) !== resolvedRequest.url) return;

        cardNode
          .setURL(resolvedPayload.url || resolvedRequest.url)
          .setTitle(resolvedPayload.title || resolvedRequest.title)
          .setIcon(resolvedPayload.icon)
          .setDescription(resolvedPayload.description)
          .setOpenTarget(resolvedPayload.openTarget || cardNode.getOpenTarget() || '_blank');
      },
      { discrete: true },
    );
  } catch {
    return;
  } finally {
    linkService.setCardMetadataLoading(cardKey, false);
  }
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
  editor.update(
    () => {
      const node = $getNodeByKey(key);
      if (!$isLinkNode(node) && !$isLinkCardNode(node)) return;
      replaceWithIframeNode(node, editor, linkService).selectNext();
    },
    { discrete: true },
  );
}

export function replaceWithInlineNode(node: LexicalNode, inlineNode: LexicalNode): void {
  // A toolbar conversion changes presentation, not the logical link unit.
  // Carry its durable identity through the temporary inline representation so
  // a later block conversion can restore the same target path.
  $preserveNodeIdentity(node, inlineNode);

  const hole = getOwningHole(node);
  if (hole) {
    replaceHolePayloadWithInlineNode(hole, node, inlineNode);
    return;
  }

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
  if (!blockNode.isInline()) {
    // Block preview and inline link variants represent the same logical
    // document unit across toolbar conversions. Preserve its durable identity
    // and annotation anchors while the runtime node class changes.
    $preserveNodeIdentity(node, blockNode);
  }

  const parent = node.getParent();
  if ($isHoleNode(parent)) {
    // Preserve the existing Hole when changing one block preview into
    // another. The target replacement remains the Hole payload, so the
    // boundary and structural identity survive the conversion.
    node.replace(blockNode);
    return;
  }

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

function getOwningHole(node: LexicalNode) {
  const parent = node.getParent();
  return $isHoleNode(parent) && parent.getContentChildren().some((child) => child.is(node))
    ? parent
    : null;
}

/**
 * Replace one direct payload in a Hole without dropping its other payloads.
 *
 * Block link previews are normally atomic Hole payloads, but the shared Hole
 * contract also permits a composite payload. Inline links cannot remain in
 * that block wrapper, so split the wrapper around the replacement and keep
 * the original payload node objects (and therefore their durable properties)
 * attached to their original logical order.
 */
function replaceHolePayloadWithInlineNode(
  hole: HoleNode,
  target: LexicalNode,
  inlineNode: LexicalNode,
): void {
  const payloads = hole.getContentChildren();
  const targetIndex = payloads.findIndex((payload) => payload.is(target));
  if (targetIndex < 0) {
    // The live editor state changed between resolving the toolbar target and
    // this update. Keep the remaining payloads intact rather than guessing
    // which structural wrapper should be replaced.
    return;
  }

  const previousPayloads = payloads.slice(0, targetIndex);
  const nextPayloads = payloads.slice(targetIndex + 1);

  if (previousPayloads.length === 0 && nextPayloads.length === 0) {
    replaceHoleWithInlineNode(hole, inlineNode);
    return;
  }

  // Detach the nodes that will move into the trailing Hole before creating
  // that wrapper. Lexical reparenting preserves each payload's key/state.
  nextPayloads.forEach((payload) => payload.remove());
  target.remove();

  const paragraph = $createParagraphNode();
  paragraph.append(inlineNode);

  if (previousPayloads.length === 0) {
    // The original Hole becomes the trailing block wrapper when the target
    // was first. Reattach the detached payloads before inserting the inline
    // paragraph, otherwise the suffix would be discarded with the target.
    hole.splice(1, 0, nextPayloads);
    hole.insertBefore(paragraph);
    return;
  }

  hole.insertAfter(paragraph);
  if (nextPayloads.length > 0) {
    const trailingHole = $createHoleNode(nextPayloads);
    paragraph.insertAfter(trailingHole);
  }
}

function replaceHoleWithInlineNode(hole: HoleNode, inlineNode: LexicalNode): void {
  // A malformed legacy tree may place a Hole under a paragraph/inline parent.
  // Keep the inline replacement legal in that case; valid block Holes become
  // a paragraph sibling so no inline node is left inside the Hole wrapper.
  const parent = hole.getParent();
  if (parent?.isInline() || $isParagraphNode(parent)) {
    hole.replace(inlineNode);
    return;
  }

  const paragraph = $createParagraphNode();
  paragraph.append(inlineNode);
  hole.replace(paragraph);
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
