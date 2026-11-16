import type { INode } from '@/editor-kernel/inode';
import { INodeHelper } from '@/editor-kernel/inode/helper';
import type { ILitexmlService } from '@/plugins/litexml';
import type { IMarkdownShortCutService } from '@/plugins/markdown/service/shortcut';

import { $isFootnoteDefinitionNode, FootnoteDefinitionNode } from '../node/FootnoteDefinitionNode';
import { $isFootnoteNode, FootnoteNode } from '../node/FootnoteNode';
import { $isFootnoteSectionNode, FootnoteSectionNode } from '../node/FootnoteSectionNode';
import { $collectFootnotes, normalizeFootnoteIdentifier } from '../utils';
import {
  createFootnoteDefinitionINode,
  createFootnoteSectionINode,
  flattenToInline,
} from './inode';

function formatDefinition(identifier: string, content: string): string {
  const body = content.trim().replaceAll(/\n+/g, '\n    ');
  return `[^${normalizeFootnoteIdentifier(identifier)}]:${body ? ` ${body}` : ''}\n`;
}

export function registerFootnoteMarkdown(markdownService: IMarkdownShortCutService) {
  markdownService.registerMarkdownWriter(FootnoteNode.getType(), (ctx, node) => {
    if (!$isFootnoteNode(node)) return false;
    ctx.appendLine(`[^${normalizeFootnoteIdentifier(node.getIdentifier())}]`);
  });

  markdownService.registerMarkdownWriter(FootnoteDefinitionNode.getType(), (ctx, node) => {
    if (!$isFootnoteDefinitionNode(node)) return false;
    const identifier = node.getIdentifier();
    ctx.addProcessor((_before, content) => formatDefinition(identifier, content));
  });

  markdownService.registerMarkdownWriter(FootnoteSectionNode.getType(), (ctx, node) => {
    if (!$isFootnoteSectionNode(node)) return false;
    const defined = new Set(
      node
        .getChildren()
        .filter($isFootnoteDefinitionNode)
        .map((definition) => definition.getIdentifier()),
    );
    const missing = Array.from($collectFootnotes().references.keys())
      .filter((identifier) => !defined.has(identifier))
      .map((identifier) => formatDefinition(identifier, ''));
    ctx.addProcessor((_before, content) => `${content}${missing.join('')}\n`);
  });

  markdownService.registerMarkdownReader('footnoteReference', (node) =>
    INodeHelper.createTypeNode(FootnoteNode.getType(), {
      identifier: normalizeFootnoteIdentifier(node.label ?? node.identifier),
    }),
  );

  markdownService.registerMarkdownReader('footnoteDefinition', (node, children) =>
    createFootnoteSectionINode([
      createFootnoteDefinitionINode(
        normalizeFootnoteIdentifier(node.label ?? node.identifier),
        flattenToInline(children as INode[]),
      ),
    ]),
  );
}

export function registerFootnoteLiteXml(litexmlService: ILitexmlService) {
  litexmlService.registerXMLWriter(FootnoteNode.getType(), (node, ctx) => {
    if (!$isFootnoteNode(node)) return false;
    return ctx.createXmlNode('footnote', { ref: node.getIdentifier() });
  });

  litexmlService.registerXMLWriter(FootnoteSectionNode.getType(), (node, ctx) => {
    if (!$isFootnoteSectionNode(node)) return false;
    return ctx.createXmlNode('footnote-section', {});
  });

  litexmlService.registerXMLWriter(FootnoteDefinitionNode.getType(), (node, ctx) => {
    if (!$isFootnoteDefinitionNode(node)) return false;
    return ctx.createXmlNode('def', { ref: node.getIdentifier() });
  });

  litexmlService.registerXMLReader('footnote', (xmlNode) =>
    INodeHelper.createTypeNode(FootnoteNode.getType(), {
      identifier: normalizeFootnoteIdentifier(xmlNode.getAttribute('ref')),
    }),
  );

  litexmlService.registerXMLReader('footnote-section', (_xmlNode, children) =>
    createFootnoteSectionINode(
      (children as INode[]).filter((child) => child.type === FootnoteDefinitionNode.getType()),
    ),
  );

  litexmlService.registerXMLReader('def', (xmlNode, children) =>
    createFootnoteDefinitionINode(
      normalizeFootnoteIdentifier(xmlNode.getAttribute('ref')),
      flattenToInline(children as INode[]),
    ),
  );
}
