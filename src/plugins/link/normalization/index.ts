/* eslint-disable @typescript-eslint/no-use-before-define */
import { LexicalEditor } from 'lexical';

import { LinkNode } from '../node/LinkNode';
import { $createSchemaNode } from '../node/SchemaNode';
import { LinkService } from '../service/i-link-service';

export function normalizeSchemaLinkNode(
  node: LinkNode,
  editor: LexicalEditor,
  linkService: LinkService,
): boolean {
  const url = node.getURL();
  const title = node.getTitle() || node.getTextContent() || url;
  const schema = linkService.parseSchemaUrl(url);
  const rule = linkService.getSchemaRule(url, {
    editor,
    schema,
    text: node.getTextContent(),
    title,
  });
  if (!rule) return false;

  const parsed = rule.parse?.(url, schema);
  const payload =
    parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? normalizeSchemaPayload(parsed as Record<string, unknown>)
      : { payload: parsed };

  if (linkService.hasSchemaLinkRenderer(url)) {
    payload.payload = {
      ...(payload.payload && typeof payload.payload === 'object' ? payload.payload : {}),
      __legacyLink: {
        rel: node.getRel(),
        target: node.getTarget(),
        text: node.getTextContent(),
        title: node.getTitle(),
      },
    };
  }

  node.replace(
    $createSchemaNode({
      payload: payload.payload,
      schemaType: (payload.schemaType as string | undefined) || rule.id,
      title: (payload.title as string | undefined) || title,
      url: (payload.url as string | undefined) || url,
    }),
  );
  return true;
}

function normalizeSchemaPayload(payload: Record<string, unknown>): Record<string, unknown> {
  if ('payload' in payload || 'schemaType' in payload || 'title' in payload || 'url' in payload) {
    return payload;
  }
  return { payload };
}
