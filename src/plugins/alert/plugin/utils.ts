import type { Blockquote } from 'mdast';

import type { IElementNode, INode } from '@/editor-kernel/inode';
import { INodeHelper } from '@/editor-kernel/inode/helper';

import { type AlertType, isAlertType } from '../node/AlertNode';

const ALERT_MARKER = /^\[!(note|tip|important|warning|caution)][\t ]*(?:\r?\n|$)/i;

const INLINE_NODE_TYPES = new Set([
  'autolink',
  'codeInline',
  'cursor',
  'footnote',
  'image',
  'linebreak',
  'link',
  'linkHighlight',
  'math',
  'mention',
  'tab',
  'text',
]);

export function matchAlertMarker(node: Blockquote): AlertType | null {
  const paragraph = node.children[0];
  if (paragraph?.type !== 'paragraph') return null;
  const text = paragraph.children[0];
  if (text?.type !== 'text') return null;
  const type = text.value.match(ALERT_MARKER)?.[1]?.toLowerCase();
  return isAlertType(type) ? type : null;
}

export function stripAlertMarker(children: INode[]): INode[] {
  const [first, ...rest] = children;
  if (!first || !INodeHelper.isParagraphNode(first)) return children;

  const [firstText, ...inline] = first.children ?? [];
  if (!firstText || !INodeHelper.isTextNode(firstText)) return children;

  const text = firstText.text.replace(ALERT_MARKER, '');
  const paragraphChildren = text ? [{ ...firstText, text }, ...inline] : inline;
  while (paragraphChildren[0]?.type === 'linebreak') paragraphChildren.shift();

  if (paragraphChildren.length === 0) return rest;
  return [{ ...first, children: paragraphChildren } as INode, ...rest];
}

export function formatAlertMarkdown(alertType: AlertType, content: string): string {
  const trimmed = content.replaceAll(/^\n+|\n+$/g, '');
  const body = trimmed ? trimmed.split('\n').map((line) => (line ? `> ${line}` : '>')) : [];
  return [`> [!${alertType.toUpperCase()}]`, ...body].join('\n').concat('\n\n');
}

export function wrapInlineChildren(children: INode[]): INode[] {
  const result: INode[] = [];
  let paragraph: IElementNode | null = null;
  for (const child of children) {
    if (INLINE_NODE_TYPES.has(child.type)) {
      if (!paragraph) {
        paragraph = INodeHelper.createParagraph();
        result.push(paragraph);
      }
      INodeHelper.appendChild(paragraph, child);
      continue;
    }
    paragraph = null;
    result.push(child);
  }
  return result;
}
