import type { IElementNode, INode, IRootNode } from '@/editor-kernel/inode';
import { INodeHelper } from '@/editor-kernel/inode/helper';

import { FootnoteDefinitionNode } from '../node/FootnoteDefinitionNode';
import { FootnoteNode } from '../node/FootnoteNode';
import { FootnoteSectionNode } from '../node/FootnoteSectionNode';

const SECTION = FootnoteSectionNode.getType();
const DEFINITION = FootnoteDefinitionNode.getType();
const REFERENCE = FootnoteNode.getType();
const INLINE_ELEMENT_TYPES = new Set(['autolink', 'link', 'linkHighlight']);

type INodeWithChildren = INode & { children?: INode[] };

function getIdentifier(node: INode): string {
  return String((node as INode & { identifier?: unknown }).identifier ?? '');
}

export function createFootnoteDefinitionINode(identifier: string, children: INode[]): IElementNode {
  return INodeHelper.createElementNode(DEFINITION, { children, identifier });
}

export function createFootnoteSectionINode(definitions: INode[]): IElementNode {
  return INodeHelper.createElementNode(SECTION, { children: definitions });
}

export function flattenToInline(children: INode[]): INode[] {
  const result: INode[] = [];
  for (const child of children) {
    const nested = (child as INodeWithChildren).children;
    if (Array.isArray(nested) && !INLINE_ELEMENT_TYPES.has(child.type)) {
      if (result.length > 0) result.push(INodeHelper.createTypeNode('linebreak'));
      result.push(...flattenToInline(nested ?? []));
      continue;
    }
    result.push(child);
  }
  return result;
}

function collect(node: INodeWithChildren, references: string[], definitions: INode[]): void {
  if (!Array.isArray(node.children)) return;
  const kept: INode[] = [];
  for (const child of node.children) {
    if (child.type === SECTION) {
      definitions.push(
        ...((child as INodeWithChildren).children ?? []).filter((item) => item.type === DEFINITION),
      );
      continue;
    }
    if (child.type === DEFINITION) {
      definitions.push(child);
      continue;
    }
    if (child.type === REFERENCE) references.push(getIdentifier(child));
    collect(child as INodeWithChildren, references, definitions);
    kept.push(child);
  }
  node.children = kept;
}

export function normalizeFootnoteINodeTree({ root }: { root: IRootNode }): void {
  const references: string[] = [];
  const definitions: INode[] = [];
  collect(root as INodeWithChildren, references, definitions);
  if (definitions.length === 0) return;

  for (const definition of definitions) {
    collect(definition as INodeWithChildren, references, []);
  }

  const order = new Map<string, number>();
  for (const identifier of references) {
    if (!order.has(identifier)) order.set(identifier, order.size);
  }

  const unique = new Map<string, INode>();
  for (const definition of definitions) {
    const identifier = getIdentifier(definition);
    if (!unique.has(identifier)) unique.set(identifier, definition);
  }

  const sorted = Array.from(unique.values()).sort(
    (a, b) =>
      (order.get(getIdentifier(a)) ?? Number.MAX_SAFE_INTEGER) -
      (order.get(getIdentifier(b)) ?? Number.MAX_SAFE_INTEGER),
  );
  INodeHelper.appendChild(root, createFootnoteSectionINode(sorted));
}
